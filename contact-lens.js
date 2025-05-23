let pvData = pv;
let htmlData = html;

let epiData = epi;
let ipsData = ips;

let getSpecification = () => {
    return "2.0.3-questionnaire-banner";
};
//document, htmlData, bannerHTML
//
const insertQuestionnaireLink = (listOfCategories, linkHTML, document, response) => {
    let shouldAppend = false; //for future usage
    let foundCategory = false;
    console.log(listOfCategories)
    console.log(listOfCategories.length)
    listOfCategories.forEach((className) => {
        if (
            response.includes(`class="${className}`) ||
            response.includes(`class='${className}`)
        ) {
            const elements = document.getElementsByClassName(className);
            for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
                const link = document.createElement("a");
                link.setAttribute("href", linkHTML);
                link.setAttribute("target", "_blank");
                link.setAttribute("class", "questionnaire-lens");

                if (shouldAppend) {
                    // Append the link as a new element inside the existing element
                    link.innerHTML = "📝 Fill out safety questionnaire";
                    el.appendChild(link);
                } else {
                    // Wrap the existing contents of the element in the link
                    link.innerHTML = el.innerHTML;
                    el.innerHTML = "";
                    el.appendChild(link);
                }
            }
            foundCategory = true;
        }
    });

    //TODO check language like (diabetes lens)


    // Clean head (same as your original logic)
    if (document.getElementsByTagName("head").length > 0) {
        document.getElementsByTagName("head")[0].remove();
    }

    // Extract HTML result
    if (document.getElementsByTagName("body").length > 0) {
        response = document.getElementsByTagName("body")[0].innerHTML;
        console.log("Response: " + response);
    } else {
        console.log("Response: " + document.documentElement.innerHTML);
        response = document.documentElement.innerHTML;
    }

    if (!response || response.trim() === "") {
        throw new Error("Annotation process failed: empty or null response");
    }

    return response;
};

let enhance = async () => {
    if (!ipsData || !ipsData.entry || ipsData.entry.length === 0) {
        throw new Error("IPS is empty or invalid.");
    }
    if (!epiData || !epiData.entry || epiData.entry.length === 0) {
        throw new Error("ePI is empty or invalid.");
    }
    let listOfCategoriesToSearch = ["grav-4"]; //what to look in extensions -made up code because there is none


    for (const entry of ipsData.entry) {
        const res = entry.resource;
        if (!res) continue;

        // 2. Look for generalPractitioner reference
        if (Array.isArray(res.generalPractitioner)) {
            for (const gpRef of res.generalPractitioner) {
                const gpId = gpRef.reference?.split("/")[1]; // Get ID from "Practitioner/123"
                if (!gpId) continue;

                const gpResource = ipsData.entry.find(e => e.resource?.id === gpId)?.resource;
                if (!gpResource) continue;

                if (
                    gpResource.resourceType === "Practitioner" ||
                    gpResource.resourceType === "Organization"
                ) {
                    const telecoms = gpResource.telecom;
                    if (Array.isArray(telecoms)) {
                        const filtered = telecoms.filter(t =>
                            ["phone", "email"].includes(t.system)
                        );
                        if (filtered.length > 0) {
                            console.log(`📞 Contact info for ${gpResource.resourceType} (${gpId}):`);
                            for (const telecom of filtered) {
                                console.log(`- ${telecom.system}: ${telecom.value}`);
                            }
                        } else {
                            console.log(`ℹ️ ${gpResource.resourceType} (${gpId}) has no phone or email.`);
                        }
                    } else {
                        console.log(`ℹ️ ${gpResource.resourceType} (${gpId}) has no telecom information.`);
                    }
                }
            }

        }
    }


    // ePI traslation from terminology codes to their human redable translations in the sections
    // in this case, if is does not find a place, adds it to the top of the ePI
    let compositions = 0;
    let categories = [];
    epi.entry.forEach((entry) => {
        if (entry.resource.resourceType == "Composition") {
            compositions++;
            //Iterated through the Condition element searching for conditions
            entry.resource.extension.forEach((element) => {

                // Check if the position of the extension[1] is correct
                if (element.extension[1].url == "concept") {
                    // Search through the different terminologies that may be avaible to check in the condition
                    if (element.extension[1].valueCodeableReference.concept != undefined) {
                        element.extension[1].valueCodeableReference.concept.coding.forEach(
                            (coding) => {
                                console.log("Extension: " + element.extension[0].valueString + ":" + coding.code)
                                // Check if the code is in the list of categories to search
                                if (listOfCategoriesToSearch.includes(coding.code)) {
                                    // Check if the category is already in the list of categories
                                    categories.push(element.extension[0].valueString);
                                }
                            }
                        );
                    }
                }
            });
        }
    });
    if (compositions == 0) {
        throw new Error('Bad ePI: no category "Composition" found');
    }

    else {


        let response = htmlData;
        let document;

        if (typeof window === "undefined") {
            let jsdom = await import("jsdom");
            let { JSDOM } = jsdom;
            let dom = new JSDOM(htmlData);
            document = dom.window.document;
            return insertQuestionnaireLink(categories, QUESTIONNAIRE_URL, document, response);
            //listOfCategories, enhanceTag, document, response
        } else {
            document = window.document;
            return insertQuestionnaireLink(categories, QUESTIONNAIRE_URL, document, response);
        }
    };
};

return {
    enhance: enhance,
    getSpecification: getSpecification,
};
