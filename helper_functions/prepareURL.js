module.exports = function (URL) {
    const URLWithoutHttps = URL.substring(URL.indexOf("//") + 2);
    const rootURL = URLWithoutHttps.substring(0, URLWithoutHttps.indexOf("/"));
    let URLSubpath = URLWithoutHttps.substring(
        URLWithoutHttps.indexOf("/") + 1
    );
    URLSubpath = URLSubpath === "" ? "root" : URLSubpath;

    let today = new Date();
    let date =
        today.getFullYear() +
        "-" +
        (today.getMonth() + 1) +
        "-" +
        today.getDate();
    let time =
        today.getHours() + "-" + today.getMinutes() + "-" + today.getSeconds();
    let dateTimeFilename = date + "--" + time;

    let dir = `/${dateTimeFilename}--${rootURL}`;

    return { dir, URLSubpath };
};
