export default function getRootURL(URL) {
    // NOTICE: this logic takes care only of var:URL such as: https://someurl.com/sub and not more deep subdomains
    let tempRootURL = URL.slice(URL.indexOf("//") + 2, URL.lastIndexOf("/"));
    if (tempRootURL.indexOf("/") !== -1)
        tempRootURL = tempRootURL.slice(0, tempRootURL.indexOf("/"));
    return tempRootURL;
}
