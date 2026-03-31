const axios = require('axios');

async function test(headers, tokenName) {
    try {
        console.log(`\nTesting ${tokenName} headers...`);
        const res = await axios.post('https://flixstreaming.uazapi.com/send/text', {
            number: '5511999999999',
            text: 'test'
        }, { headers, validateStatus: () => true });
        
        console.log(`Status: ${res.status}`);
        console.log(`Data:`, res.data);
    } catch (err) {
        console.log(`Error:`, err.message);
    }
}

async function run() {
    const instanceToken = '10b97f21-ae5d-43fd-b5f8-c57499c98537';
    const adminToken = 'PSuOk8D9THnSiAzgfeJmpcfMGbKUpCvlzzS5oanTVTYT5TQg3';
    
    // Test 1: apikey = adminToken
    await test({ 'apikey': adminToken }, 'apikey=adminToken');
    
    // Test 2: apikey = instanceToken
    await test({ 'apikey': instanceToken }, 'apikey=instanceToken');

    // Test 3: token = adminToken
    await test({ 'token': adminToken }, 'token=adminToken');
    
    // Test 4: token = instanceToken
    await test({ 'token': instanceToken }, 'token=instanceToken');
    
    // Test 5: Authorization Bearer = adminToken
    await test({ 'Authorization': `Bearer ${adminToken}` }, 'Bearer=adminToken');
    
    // Test 6: Authorization Bearer = instanceToken
    await test({ 'Authorization': `Bearer ${instanceToken}` }, 'Bearer=instanceToken');
    
    // Test 7: Evolution API Style
    const evoHeaders = { 'apikey': adminToken, 'instance': '56mMDx' };
    await test(evoHeaders, 'Evolution Style');
    
    // Test 8: WppConnect Style
    try {
        console.log(`\nTesting WppConnect Style (/api/56mMDx/send-message)...`);
        const res = await axios.post('https://flixstreaming.uazapi.com/api/56mMDx/send-message', {
            phone: '5511999999999',
            message: 'test'
        }, { headers: { 'Authorization': `Bearer ${instanceToken}` }, validateStatus: () => true });
        console.log(`Status: ${res.status}`);
        console.log(`Data:`, res.data);
    } catch (e) {}

    // Test 9: /message/sendText/56mMDx
    try {
        console.log(`\nTesting Evolution API Path Style (/message/sendText/56mMDx)...`);
        const res = await axios.post('https://flixstreaming.uazapi.com/message/sendText/56mMDx', {
            number: '5511999999999',
            options: { delay: 1200 },
            textMessage: { text: "test" }
        }, { headers: { 'apikey': adminToken }, validateStatus: () => true });
        console.log(`Status: ${res.status}`);
        console.log(`Data:`, res.data);
    } catch (e) {}
}

run();
