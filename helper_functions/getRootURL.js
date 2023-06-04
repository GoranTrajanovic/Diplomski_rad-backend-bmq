export default function getRootURL(URL) {
    // NOTICE: this logic takes care only of var:URL such as: https://someurl.com/sub and not more deep subdomains
    return URL.slice(URL.indexOf("//") + 2, URL.lastIndexOf("/"));
}
