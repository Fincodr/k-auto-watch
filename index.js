const moment = require('moment');
const fs = require('fs');
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const options = new chrome.Options();
const chromeOptions = options.headless();
const nodemailer = require('nodemailer');

const { email, pass, google_user, google_pass, notify_email } = require('./config.json');

const stateFileName = 'state.json';
const TIMEOUT = 60000;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: google_user,
    pass: google_pass
  }
});

const emailInput = By.id('input-email');
const passwordInput = By.id('input-password');

let fields = [];
fields.push({ f: 'ComissionNumber', t: 'Tilausnumero' });
fields.push({ f: 'CustomerOrderDate', t: 'Tilauspvm' });
fields.push({ f: 'ProductionWeek', t: 'Alustava tuotantoviikko' });
fields.push({ f: 'ProductionDate', t: 'Tuotantopvm' });
fields.push({ f: 'ImportDate', t: 'Maahantulopvm' });
fields.push({ f: 'DeliveryStatus', t: 'Tila' });
fields.push({ f: 'RegisterNumber', t: 'Rekisterinumero' });
fields.push({ f: 'Vin', t: 'Alustanumero' });
fields.push({ f: 'Brand', t: 'Merkki' });
fields.push({ f: 'ModelCode', t: 'Mallikoodi' });
fields.push({ f: 'Model', t: 'Malli' });
fields.push({ f: 'ModelYear', t: 'Vuosimalli' });
fields.push({ f: 'VehicleClass', t: 'Ajoneuvoluokka' });
fields.push({ f: 'TotalMass', t: 'Kokonaismassa (kg)' });
fields.push({ f: 'TransmissionType', t: 'Vaihteistotyyppi' });
fields.push({ f: 'TransmissionCode', t: 'Vaihteistokoodi' });
fields.push({ f: 'EngineNumber', t: 'Moottorinumero' });
fields.push({ f: 'EngineCode', t: 'Moottoritunnus' });
fields.push({ f: 'EngineDescription', t: 'Moottorin kuvaus' });
fields.push({ f: 'EngineVolume', t: 'Moottoritilavuus (cm³)' });
fields.push({ f: 'EngineHorsePower', t: 'Moottoriteho (KW)' });
fields.push({ f: 'FuelType', t: 'Polttoaine' });
fields.push({ f: 'FuelConsumptionCity', t: 'Kaupunki (l/100km)' });
fields.push({ f: 'FuelConsumptionOutCity', t: 'Maantie (l/100km)' });
fields.push({ f: 'FuelConsumptionCombined', t: 'Yhdistetty (l/100km)' });
fields.push({ f: 'Color', t: 'Väri' });
fields.push({ f: 'ColorInterior', t: 'Sisustan väri' });

let getFieldName = (id) => {
    for (field of fields) {
        if (field.f === id) {
            return field.t;
        }
    }
    return null;
}

let save = (filename, data) => {
    fs.writeFileSync(filename, data);
}

let load = (filename, data) => {
    if (fs.existsSync(filename)) {
        return JSON.parse(fs.readFileSync(filename));
    }
    return null;
}

let driver = new Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)
    .build();

async function example()
{
    try {
        await driver.get('https://login.k-auto.fi/');
        await driver.wait(until.elementLocated(emailInput), TIMEOUT);
        await driver.findElement(emailInput).sendKeys(email);
        await driver.wait(until.elementLocated(passwordInput), 1000);
        await driver.findElement(passwordInput).sendKeys(pass, Key.RETURN);
        await driver.wait(until.urlIs('https://oma.k-auto.fi/'), TIMEOUT);
        await driver.get('https://oma.k-auto.fi/tilatun-auton-tiedot/');
        await driver.wait(until.urlIs('https://oma.k-auto.fi/tilatun-auton-tiedot/'), TIMEOUT);
        let json = {};
        for (field of fields) {
            const findBy = By.css(`[id$=${field.f}]`);
            json[field.f] = await driver.findElement(findBy).getText();
        }
        await driver.close();
        return json;
    } catch (e) {
        console.error(e);
        await driver.close();
    }
}

const state = load(stateFileName);

example().then((res) => {
    try {
        save(stateFileName, JSON.stringify(res, null, 2));
        var body = '';
        var html = '<pre>';
        var changes = 0;
        for (field of fields) {
            body += `${field.t}: ${res[field.f]}\n`;
            let changed = false;
            if (state != null && state[field.f] !== res[field.f]) {
                changed = true;
                changes++;
            } else {
                changed = false;
            }
            if (changed) {
                html += '<font color="red">';
            }
            html += `${field.t}: <b>${res[field.f]}</b>`;
            if (changed) {
                html += ` (${state[field.f]}) </font>`;
            }
            html += '<br/>\n';
        }
        html += '</pre>';
        if (changes > 0) {
            var mailOptions = {
                from: google_user,
                to: notify_email,
                subject: res.Model,
                text: body,
                html: html
            };
            transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.error(`${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}: ${error}`);
            } else {
                console.log(`${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}: ${changes} change(s) detected. Email sent -> (${info.response})`);
            }
            });
        } else {
            console.log(`${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}: No changes detected.`);
        }
    } catch (e) {
        console.error(`${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}: Exception ${e}`);
    }
});
