export default function prepareURL(URL) {
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
    let time = today.getHours() + "-" + today.getMinutes();
    let dateTimeFilename = date + "--" + time;

    // let dir = `/${dateTimeFilename}--${rootURL}`;
    let dir = `${rootURL}/${dateTimeFilename}`;

    return { dir, URLSubpath };
}
