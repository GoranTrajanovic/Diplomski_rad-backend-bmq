export default function prepareURL(URL) {
    const URLWithoutHttps = URL.substring(URL.indexOf("//") + 2);
    const plainRootURL = URLWithoutHttps.includes("/")
        ? URLWithoutHttps.substring(0, URLWithoutHttps.indexOf("/"))
        : URLWithoutHttps;
    let URLSubpath = URLWithoutHttps.substring(
        URLWithoutHttps.indexOf("/") + 1
    );
    URLSubpath = URLWithoutHttps.includes("/") ? URLSubpath : "root";

    /* let today = new Date();
    let date =
        today.getFullYear() +
        "-" +
        (today.getMonth() + 1) +
        "-" +
        today.getDate();
    let time = today.getHours() + "-" + today.getMinutes();
    let dateTimeFilename = date + "--" + time; */

    // let dir = `/${dateTimeFilename}--${plainRootURL}`;
    // let dir = `${plainRootURL}/${dateTimeFilename}`;

    return { plainRootURL, URLSubpath };
}
