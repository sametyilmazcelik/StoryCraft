const fetch = require('node-fetch');

async function test() {
    console.log("Testing generation...");
    const res = await fetch("http://localhost:3000/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "A highly detailed jewelers hands", index: 0 })
    });
    const data = await res.json();
    console.log("Result:", data);
}

test();
