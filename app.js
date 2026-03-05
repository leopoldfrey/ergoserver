const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const serveIndex = require("serve-index");

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ------------------- ROUTES HTML -------------------
app.get("/", (req, res) => res.sendFile(__dirname + "/public/index.html"));
app.get("/ergoconf.html", (req, res) => res.sendFile(__dirname + "/public/ergoconf.html"));
app.get("/ergocontroller.html", (req, res) => res.sendFile(__dirname + "/public/ergocontroller.html"));
app.get("/ergoselfdimension.html", (req, res) => res.sendFile(__dirname + "/public/ergoselfdimension.html"));

// ------------------- STATIC -------------------
app.use('/vendor', express.static('public/vendor'));
app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/img', express.static('public/img'));
app.use('/uploads', express.static(uploadDir));
app.use('/uploads', serveIndex(uploadDir));

// ------------------- START SERVER -------------------
server.listen(port, () => console.log("Web Server listening on port", port));

// ------------------- WEBSOCKET -------------------
const wss = new WebSocket.Server({ server });
let currentStage = 0;
let currentStandbyMessage = "FOCUS ON THE CONFERENCE";

wss.on("connection", (ws) => {
    console.log("New WS connection");

ws.on("message", (data) => {
    //console.log("Received raw message:", data); // <- debug

    try {
        // 1️⃣ Tout est Buffer en Node
        if (Buffer.isBuffer(data)) {
            // Vérifier si c'est un message image (header + image)
            if (data.length > 4) {
                const headerLen = data.readUInt32BE(0); // premiers 4 octets = header length
                console.log("Header length:", headerLen, "Data length:", data.length);
                //console.log("Header length:", headerLen);
                if (4 + headerLen <= data.length) {
                    //const headerBuf = data.slice(4, 4 + headerLen);
                    let header;
                    try {
                        header = JSON.parse(headerBuf.toString("utf8"));
                    } catch {
                        header = null;
                    }

                    //console.log("Parsed header:", header);
                    if (header && header.type === "uploadImage") {
                        console.log("Processing image upload...");
                        const imgBuf = data.slice(4 + headerLen);
                        const filename = `${Date.now()}_${header.name.replace(/\s+/g, "_")}`;
                        const filepath = path.join(uploadDir, filename);
                        try {
                          fs.writeFileSync(filepath, imgBuf);
                        } catch (err) {
                          console.error("Failed to save image:", err);
                          return;
                        }
                        console.log("Image saved:", filename);

                        broadcast({
                            type: "newimage",
                            standbyMsg: filename,
                            stage: header.stage
                        });
                        return; // terminé
                    }
                }
            }

            // --- sinon c'est du JSON texte classique ---
            data = data.toString("utf8"); // ← convertir **après** avoir vérifié image
        }

        // 2️⃣ Parser le JSON texte
        const msg = JSON.parse(data);

        switch (msg.type) {
            case "getInit":
                console.log("Client requested initial state");
                ws.send(JSON.stringify({
                  type: "initState",
                  stage: currentStage,
                  standbyMsg: currentStandbyMessage
                }));
                break;

            case "broadcast":
                console.log("Broadcasting stage:", msg.stage, "standbyMsg:", msg.standbyMsg);
                currentStage = msg.stage;
                currentStandbyMessage = msg.standbyMsg;
                broadcast({
                    type: "changeState",
                    stage: currentStage,
                    standbyMsg: currentStandbyMessage
                }, ws);
                break;

            case "deleteAllServerData":
                console.log("Deleting all server data...");
                fs.readdir(uploadDir, (err, files) => {
                    if (err) return console.log(err);
                    for (const f of files) {
                      try{ fs.unlinkSync(path.join(uploadDir, f)); } 
                      catch(e) { console.error("Failed to delete file:", f, e); }
                    }
                });
                break;

            // --- Nouvelle gestion Mail via WS ---
            case "mail":
                if (msg.mail) {
                  console.log("Receiving e-mail via WS:", msg.mail);
                  const mailFile = path.join(uploadDir, "mails.txt");
                  fs.appendFile(mailFile, msg.mail + "\r\n", (err) => {
                    if (err) console.log("Error saving e-mail via WS:", err);
                    else console.log("E-mail saved via WS:", msg.mail);

                    // Ack côté client
                    ws.send(JSON.stringify({ type: "mailAck", status: "ok" }));
                  });
                } else {
                  console.log("Invalid mail received via WS");
                }
                break;
        }

    } catch (err) {
        console.error("Error processing message:", err);
    }
});
});

function broadcast(msg, exclude) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== exclude) {
            client.send(JSON.stringify(msg));
        }
    });
}