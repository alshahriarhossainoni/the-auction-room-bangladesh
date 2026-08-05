fetch("market-data.json")
.then(response => response.json())
.then(data => {

    document.getElementById("instrument").textContent = data.instrument;
    document.getElementById("date").textContent = data.date;

    document.getElementById("callResistance").textContent = data.callResistance;
    document.getElementById("putSupport").textContent = data.putSupport;
    document.getElementById("gammaWall").textContent = data.gammaWall;
    document.getElementById("hvl").textContent = data.hvl;

    document.getElementById("weeklyOutlook").textContent = data.weeklyOutlook;

    const bias = document.getElementById("bias");

    bias.textContent = data.bias;

    bias.classList.remove(
        "positive",
        "negative",
        "neutral",
        "flip"
    );

    switch(data.bias.toLowerCase()){

        case "positive gamma":
            bias.classList.add("positive");
            break;

        case "negative gamma":
            bias.classList.add("negative");
            break;

        case "gamma flip":
            bias.classList.add("flip");
            break;

        default:
            bias.classList.add("neutral");
    }

});
