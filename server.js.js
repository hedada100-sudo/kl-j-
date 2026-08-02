const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ডেটা ফাইল ম্যানেজমেন্ট
const DATA_FILE = './data.json';

const loadData = () => {
    if (!fs.existsSync(DATA_FILE)) {
        const initData = { users: [], depMethods: [], withMethods: [], depRequests: [], withRequests: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initData, null, 2));
        return initData;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
};

const saveData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// API 1: ইউজার রেজিস্ট্রেশন (প্রথম বার ১০০ টাকা বোনাস)
app.post('/api/register', (req, res) => {
    const { email, password, phone } = req.body;
    let data = loadData();
    if (data.users.find(u => u.email === email)) return res.json({ success: false, message: 'User already exists' });
    const newUser = { id: Date.now(), email, password, phone, balance: 100 };
    data.users.push(newUser);
    saveData(data);
    res.json({ success: true, user: newUser });
});

// API 2: ইউজার লগইন
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    let data = loadData();
    const user = data.users.find(u => u.email === email && u.password === password);
    if (!user) return res.json({ success: false, message: 'Invalid credentials' });
    res.json({ success: true, user });
});

// API 3: অ্যাডমিন লগইন (পাসওয়ার্ড amitop@11)
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === 'amitop@11') return res.json({ success: true });
    res.json({ success: false });
});

// API 4: অ্যাডমিন ডিপোজিট মেথড
app.get('/api/admin/depMethods', (req, res) => {
    let data = loadData(); res.json(data.depMethods);
});
app.post('/api/admin/depMethods', (req, res) => {
    let data = loadData(); data.depMethods.push(req.body); saveData(data); res.json({ success: true });
});
app.delete('/api/admin/depMethods', (req, res) => {
    let data = loadData(); data.depMethods = data.depMethods.filter(m => m.name !== req.body.name); saveData(data); res.json({ success: true });
});

// API 5: অ্যাডমিন উইথড্র মেথড
app.get('/api/admin/withMethods', (req, res) => {
    let data = loadData(); res.json(data.withMethods);
});
app.post('/api/admin/withMethods', (req, res) => {
    let data = loadData(); data.withMethods.push(req.body); saveData(data); res.json({ success: true });
});
app.delete('/api/admin/withMethods', (req, res) => {
    let data = loadData(); data.withMethods = data.withMethods.filter(m => m.name !== req.body.name); saveData(data); res.json({ success: true });
});

// API 6: অ্যাডমিন ম্যানুয়াল ব্যালেন্স এড
app.post('/api/admin/addBalance', (req, res) => {
    const { email, amount } = req.body;
    let data = loadData();
    let user = data.users.find(u => u.email === email);
    if (!user) return res.json({ success: false, message: 'User not found' });
    user.balance += amount;
    saveData(data);
    res.json({ success: true, user });
});

// API 7: পেন্ডিং রিকোয়েস্ট দেখা ও অ্যাপ্রুভ করা
app.get('/api/admin/pendingRequests', (req, res) => {
    let data = loadData();
    res.json({ depRequests: data.depRequests, withRequests: data.withRequests });
});
app.post('/api/admin/approveRequest', (req, res) => {
    const { type, idx, isApprove } = req.body;
    let data = loadData();
    if (type === 'Deposit') {
        let reqs = data.depRequests;
        if (reqs[idx] && reqs[idx].status === 'pending') {
            reqs[idx].status = isApprove ? 'approved' : 'rejected';
            if (isApprove) { let user = data.users.find(u => u.email === reqs[idx].userEmail); if (user) user.balance += reqs[idx].amount; }
            saveData(data); return res.json({ success: true });
        }
    } else {
        let reqs = data.withRequests;
        if (reqs[idx] && reqs[idx].status === 'pending') {
            reqs[idx].status = isApprove ? 'approved' : 'rejected';
            if (!isApprove) { let user = data.users.find(u => u.email === reqs[idx].userEmail); if (user) user.balance += reqs[idx].amount; }
            saveData(data); return res.json({ success: true });
        }
    }
    res.json({ success: false });
});

// API 8: ইউজার ডিপোজিট ও উইথড্র সাবমিট
app.post('/api/user/deposit', (req, res) => {
    let data = loadData(); data.depRequests.push({ ...req.body, status: 'pending' }); saveData(data); res.json({ success: true });
});
app.post('/api/user/withdraw', (req, res) => {
    const { userEmail, method, address, amount } = req.body;
    let data = loadData();
    let user = data.users.find(u => u.email === userEmail);
    if (!user || user.balance < amount) return res.json({ success: false, message: 'Insufficient balance' });
    user.balance -= amount;
    data.withRequests.push({ userEmail, method, address, amount, status: 'pending' });
    saveData(data);
    res.json({ success: true });
});

// API 9: ট্রেড করার সময় ব্যালেন্স আপডেট
app.post('/api/user/trade', (req, res) => {
    const { userEmail, amount, profit } = req.body; // profit +9 হলে যোগ, -10 হলে কাটা
    let data = loadData();
    let user = data.users.find(u => u.email === userEmail);
    if (!user) return res.json({ success: false });
    user.balance += profit; 
    saveData(data);
    res.json({ success: true, newBalance: user.balance });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});