// TODO: CLEAN CODE AND FIX MUTATIONS AND ADD MUTATIONS INSTEAD OF SCROLL
main();
// api auota: https://console.developers.google.com/apis/api/youtube.googleapis.com/metrics?project=chromeextensionytlikeratio&pageState=(%22duration%22:(%22groupValue%22:%22PT1H%22))
function main() {

    // Initial calls for thumbnails mutation observer cannot catch
    var manualCallTimes = [0, 800, 1000, 1200, 1400, 1750, 2000, 2500, 3500, 5000];
    if (1) {
        for (var i = 0; i < manualCallTimes.length; i++) {
            setTimeout(() => {
                createAndDisplayLikeRatios();
            }, manualCallTimes[i]);
        }
    }

    // Muatation part to cover new thumbnails added via JS
    setTimeout(() => {
        const observer = createMutationObserverForCreateAndDisplayLikeRatios();
        var placesToObserver = [];
        var mainPageContentDiv = getMainPageContentDiv(); placesToObserver.push(mainPageContentDiv); // div where new video elements are added
        var videoPageItemsDiv  = getVideoPageItemsDiv(); placesToObserver.push(videoPageItemsDiv); // TODO: FIXME currently will observer each anchor going in individually and will make make calls // div where new video elements are added
        if (window.location.href.includes("youtube.com/results") == true) {document.addEventListener("scroll", createAndDisplayLikeRatios);}    // TODO: DO THE FIXME AND REMOVE THIS BANDAID FIX
        //var searchPageItemsDiv  = getSearchPageItemsDiv(); placesToObserver.push(searchPageItemsDiv);  // TODO: FIXME     // div where a new div is added where new vid elements are added inside


        for (var i = 0; i < placesToObserver.length; i++) {
            if (placesToObserver[i].length != 0) {
                observer.observe(placesToObserver[i], {childList: true});
            }
        }
    }, 1200);
}

function getMainPageContentDiv() {
    var videoPageItemsDiv = document.getElementById("contents") || [];
    if (videoPageItemsDiv.className == "style-scope ytd-rich-grid-renderer") {
        return videoPageItemsDiv;
    };

    return [];
}

function getVideoPageItemsDiv() {
    var videoPageItemsDiv = document.getElementsByClassName("style-scope ytd-watch-next-secondary-results-renderer") || [];

    for (var i = 0; i < videoPageItemsDiv.length; i++) {
        if (videoPageItemsDiv[i].id == "items") {
            //console.log("videoPageItemsDiv[i]");
            //console.log(videoPageItemsDiv[i]);
            return videoPageItemsDiv[i];
        }
    }

    return [];
}

function getSearchPageItemsDiv() { // currently this is broken because unlike the others that have a div with thumbnails inside, this has a div that gets divs added to it that has thumbnails as children and those children are not loaded all at once
    var searchPageItemsDiv = document.getElementsByClassName("style-scope ytd-section-list-renderer") || [];

    for (var i = 0; i < searchPageItemsDiv.length; i++) {
        if (searchPageItemsDiv[i].id == "contents") {
            //console.log("searchPageItemsDiv[i]");
            //console.log(searchPageItemsDiv[i]);
            return searchPageItemsDiv[i];
        }
    }

    return [];
}

function createMutationObserverForCreateAndDisplayLikeRatios() {
    const observer = new MutationObserver(mutations => {
        var newAnchors = [];
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(addedNode => {
                possibleNewAnchor = addedNode.getElementsByClassName("yt-simple-endpoint inline-block style-scope ytd-thumbnail") || [];
                for (var i = 0; i < possibleNewAnchor.length; i++) {
                    //console.log(possibleNewAnchor[i]);
                    newAnchors.push(possibleNewAnchor[i]);
                }
            });
        });
        createAndDisplayLikeRatios(newAnchors);
    });

    return observer;
}


function createAndDisplayLikeRatios(possibleAnchors = null) {

    var tmpAnchors = possibleAnchors;
    if (tmpAnchors == null || tmpAnchors instanceof Event) { // default
        tmpAnchors = document.getElementsByClassName("yt-simple-endpoint inline-block style-scope ytd-thumbnail") || [];
    }
    //console.log("tmpAnchors");
    //console.log(tmpAnchors);

    var thumbnailAnchors = [];
    var ytVideoLinkLength = 43; // ie len("https://www.youtube.com/watch?v=3glbiMVmhdw")
    //console.log(tmpAnchors.length)
    for (var i = 0; i < tmpAnchors.length; i++) {
        if (tmpAnchors[i].href.length >= ytVideoLinkLength) {
            if (tmpAnchors[i].firstElementChild.tagName.toLowerCase() != 'span') { // already added one from before
                thumbnailAnchors.push(tmpAnchors[i]);
            }
        } else {
            //console.log(tmpAnchors[i].href);
        }
    }
    var maxApiSizeCall = 50; // or it will give a 4xx error code
    if (thumbnailAnchors.length > maxApiSizeCall) {
        thumbnailAnchors = thumbnailAnchors.slice(thumbnailAnchors.length - maxApiSizeCall, thumbnailAnchors.length)
    }
    //console.log(thumbnailAnchors.length)
    var vidIDs = [];
    for (var i = 0; i < thumbnailAnchors.length; i++) {
        vidIDs.push(getVidIDFromURI(thumbnailAnchors[i].href));
    }

    if (vidIDs.length == 0) {
        //console.log("No updates");
        return;
    }
    //console.log("New updates (api call will be made)");

    let statisticsRequest = getApiResponseStatistics(vidIDs);

    var likeRatios = [];
    statisticsRequest.then(function(response) {
        var data = response['items'];
        for (var i = 0; i < data.length; i++) {
            var likes = parseInt(data[i]["statistics"]["likeCount"]);
            var dislikes = parseInt(data[i]["statistics"]["dislikeCount"]);
            likeRatios.push(likes * 100 / (likes + dislikes));
        }

        for (var i = 0; i < thumbnailAnchors.length; i++) {
            var text = thumbnailAnchors[i].innerHTML;
            var likeRatioStr = Math.round(likeRatios[i]).toString().concat("%");
            if (likeRatioStr[0] != "N") {// "N" for  NaN
                createAndInsertSpan(likeRatioStr, thumbnailAnchors[i]);
            }
        }
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
function getVidIDFromURI(uri) {
    vidIDLen = 11;
    var parialLinkLen = 32; // ie len("https://www.youtube.com/watch?v=")
    var vidID = uri.substring(uri.length - vidIDLen, uri.length);
    if (uri.length >= parialLinkLen + vidIDLen) {
        vidID = uri.substring(parialLinkLen, parialLinkLen + vidIDLen);
    }
    return vidID;
}

async function getApiResponseStatistics(vidIDs) {
    var apiKey = "AIzaSyBP6GdlivUcAdW9fXv3iJ96yUlowDfftrw";
    var baseURI = "https://youtube.googleapis.com/youtube/v3/videos?";
    var part = "part=statistics&";
    var ids = "";
    for (var i = 0; i < vidIDs.length; i++) {
        ids = ids.concat("id=", vidIDs[i], "&");
    }
    var accessToken = "access_token=".concat(apiKey, "&");
    var key = "key=".concat(apiKey);

    var url = baseURI.concat(part, ids, accessToken, key);
    //console.log(url);
    const response = await fetch(url);
    var data = await response.json();
   return data;
}

function createAndInsertSpan(likeRatioStr, thumbnailAnchor) {
    let span = document.createElement('span');
    span.textContent = likeRatioStr;
    span.id = "likeRatio";
    span.style.position = "absolute";
    span.style.color = "white";
    span.style.background = "rgba(0,0,0,0.8)";
    span.style.borderRadius = "2px";
    span.style.padding = "3px 4px";
    span.style.margin = "4px";
    span.style.zIndex = "1";
    span.style.fontSize = "12px";

    thumbnailAnchor.insertBefore(span, thumbnailAnchor.firstElementChild);
}