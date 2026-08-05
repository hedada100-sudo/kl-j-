const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============================================================
//  ডেটা ফাইল পাথ
// ============================================================
const DATA_FILE = path.join(__dirname, 'data.json');

// ============================================================
//  ডেটা লোড ও সেভ ফাংশন
// ============================================================
const loadData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initData = {
                users: [],
                depMethods: [],
                withMethods: [],
                depRequests: [],
                withRequests: [],
                config: {}
            };
            fs.writeFileSync(DATA_FILE, JSON.stringify(initData, null, 2));
            return initData;
        }
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error('❌ Error loading data:', e.message);
        return { users: [], depMethods: [], withMethods: [], depRequests: [], withRequests: [], config: {} };
    }
};

const saveData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('❌ Error saving data:', e.message);
        throw new Error('Failed to save data');
    }
};

// ============================================================
//  ইউটিলিটি ফাংশন
// ============================================================
function isValidAmount(amount) {
    return typeof amount === 'number' && isFinite(amount) && amount > 0 && amount <= 1e12;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ============================================================
//  ১. AUTHENTICATION
// ============================================================

// 1.1 রেজিস্টার
app.post('/api/register', (req, res) => {
    try {
        const { email, password, phone } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        let data = loadData();
        if (data.users.find(u => u.email === email)) {
            return res.status(409).json({ success: false, message: 'User already exists' });
        }
        const newUser = {
            id: generateId(),
            email,
            password,
            phone: phone || '',
            balance: 100,
            isGoogle: false,
            createdAt: new Date().toISOString()
        };
        data.users.push(newUser);
        saveData(data);
        const userToReturn = { ...newUser };
        delete userToReturn.password;
        res.status(201).json({ success: true, user: userToReturn });
    } catch (e) {
        console.error('Register error:', e);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// 1.2 লগইন
app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        let data = loadData();
        const user = data.users.find(u => u.email === email && u.password === password);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const userToReturn = { ...user };
        delete userToReturn.password;
        res.json({ success: true, user: userToReturn });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// 1.3 Google Auth
app.post('/api/google-auth', (req, res) => {
    try {
        const { email, name, uid } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        let data = loadData();
        let user = data.users.find(u => u.email === email);
        if (user) {
            const userToReturn = { ...user };
            delete userToReturn.password;
            return res.json({ success: true, user: userToReturn });
        }
        const newUser = {
            id: generateId(),
            email,
            password: null,
            phone: name || '',
            balance: 100,
            isGoogle: true,
            createdAt: new Date().toISOString()
        };
        data.users.push(newUser);
        saveData(data);
        const userToReturn = { ...newUser };
        delete userToReturn.password;
        res.status(201).json({ success: true, user: userToReturn });
    } catch (e) {
        console.error('Google auth error:', e);
        res.status(500).json({ success: false, message: 'Server error during Google authentication' });
    }
});

// 1.4 অ্যাডমিন লগইন
app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        if (password === 'amitop@11') {
            return res.json({ success: true });
        }
        res.status(401).json({ success: false, message: 'Invalid admin password' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
//  ২. অ্যাডমিন: ইউজার লিস্ট
// ============================================================
app.get('/api/admin/users', (req, res) => {
    try {
        let data = loadData();
        const users = data.users.map(u => {
            const { password, ...rest } = u;
            return rest;
        });
        res.json({ success: true, users });
    } catch (e) {
        console.error('Fetch users error:', e);
        res.status(500).json({ success: false, message: 'Server error fetching users' });
    }
});

// ============================================================
//  ৩. অ্যাডমিন: ডিপোজিট মেথড
// ============================================================
app.get('/api/admin/depMethods', (req, res) => {
    try {
        let data = loadData();
        res.json(data.depMethods);
    } catch (e) {
        console.error('Fetch dep methods error:', e);
        res.status(500).json([]);
    }
});

app.post('/api/admin/depMethods', (req, res) => {
    try {
        const { name, address } = req.body;
        if (!name || !address) {
            return res.status(400).json({ success: false, message: 'Name and address are required' });
        }
        let data = loadData();
        if (data.depMethods.find(m => m.name === name)) {
            return res.status(409).json({ success: false, message: 'Method already exists' });
        }
        data.depMethods.push({ name, address });
        saveData(data);
        res.json({ success: true });
    } catch (e) {
        console.error('Add dep method error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/depMethods', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Method name is required' });
        }
        let data = loadData();
        data.depMethods = data.depMethods.filter(m => m.name !== name);
        saveData(data);
        res.json({ success: true });
    } catch (e) {
        console.error('Delete dep method error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
//  ৪. অ্যাডমিন: উইথড্র মেথড
// ============================================================
app.get('/api/admin/withMethods', (req, res) => {
    try {
        let data = loadData();
        res.json(data.withMethods);
    } catch (e) {
        console.error('Fetch with methods error:', e);
        res.status(500).json([]);
    }
});

app.post('/api/admin/withMethods', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        let data = loadData();
        if (data.withMethods.find(m => m.name === name)) {
            return res.status(409).json({ success: false, message: 'Method already exists' });
        }
        data.withMethods.push({ name });
        saveData(data);
        res.json({ success: true });
    } catch (e) {
        console.error('Add with method error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/withMethods', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Method name is required' });
        }
        let data = loadData();
        data.withMethods = data.withMethods.filter(m => m.name !== name);
        saveData(data);
        res.json({ success: true });
    } catch (e) {
        console.error('Delete with method error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
//  ৫. অ্যাডমিন: ম্যানুয়াল ব্যালেন্স এড
// ============================================================
app.post('/api/admin/addBalance', (req, res) => {
    try {
        const { email, amount } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        if (!isValidAmount(amount)) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
        let data = loadData();
        const user = data.users.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        user.balance += amount;
        saveData(data);
        res.json({ success: true, user: { email: user.email, balance: user.balance } });
    } catch (e) {
        console.error('Add balance error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
//  ৬. অ্যাডমিন: পেন্ডিং রিকোয়েস্ট
// ============================================================
app.get('/api/admin/pendingRequests', (req, res) => {
    try {
        let data = loadData();
        const depReqs = data.depRequests.map(r => ({ ...r, type: 'deposit' }));
        const withReqs = data.withRequests.map(r => ({ ...r, type: 'withdraw' }));
        const all = [...depReqs, ...withReqs];
        res.json(all);
    } catch (e) {
        console.error('Fetch pending requests error:', e);
        res.status(500).json([]);
    }
});

app.post('/api/admin/approveRequest', (req, res) => {
    try {
        const { requestId, isApprove } = req.body;
        if (!requestId) {
            return res.status(400).json({ success: false, message: 'Request ID is required' });
        }
        let data = loadData();
        let found = false;

        // ডিপোজিট রিকোয়েস্ট খুঁজি
        for (let i = 0; i < data.depRequests.length; i++) {
            const req = data.depRequests[i];
            if (req.id === requestId && req.status === 'pending') {
                req.status = isApprove ? 'approved' : 'rejected';
                if (isApprove) {
                    const user = data.users.find(u => u.email === req.userEmail);
                    if (user) user.balance += req.amount;
                }
                found = true;
                break;
            }
        }

        // উইথড্র রিকোয়েস্ট খুঁজি (যদি ডিপোজিটে না পায়)
        if (!found) {
            for (let i = 0; i < data.withRequests.length; i++) {
                const req = data.withRequests[i];
                if (req.id === requestId && req.status === 'pending') {
                    req.status = isApprove ? 'approved' : 'rejected';
                    if (!isApprove) {
                        const user = data.users.find(u => u.email === req.userEmail);
                        if (user) user.balance += req.amount; // রিফান্ড
                    }
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            return res.status(404).json({ success: false, message: 'Request not found or already processed' });
        }
        saveData(data);
        res.json({ success: true, message: `Request ${isApprove ? 'approved' : 'rejected'}` });
    } catch (e) {
        console.error('Approve request error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
//  ৭. ইউজার: ডিপোজিট
// ============================================================
app.post('/api/user/deposit', (req, res) => {
    try {
        const { userEmail, method, txid, amount } = req.body;
        if (!userEmail || !method || !txid || !amount) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        if (!isValidAmount(amount)) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
        let data = loadData();

        const user = data.users.find(u => u.email === userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // মেথড ভ্যালিডেশন
        const methodExists = data.depMethods.find(m => m.name === method);
        if (!methodExists) {
            return res.status(400).json({ success: false, message: 'Invalid deposit method' });
        }

        const newReq = {
            id: generateId(),
            userEmail,
            method,
            txid,
            amount,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        data.depRequests.push(newReq);
        saveData(data);
        res.json({ success: true, message: 'Deposit request submitted', requestId: newReq.id });
    } catch (e) {
        console.error('Deposit error:', e);
        res.status(500).json({ success: false, message: 'Server error during deposit submission' });
    }
});

// ============================================================
//  ৮. ইউজার: উইথড্র
// ============================================================
app.post('/api/user/withdraw', (req, res) => {
    try {
        const { userEmail, method, address, amount } = req.body;
        if (!userEmail || !method || !address || !amount) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        if (!isValidAmount(amount)) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
        if (amount < 50) {
            return res.status(400).json({ success: false, message: 'Minimum withdraw is 50 USDT' });
        }
        let data = loadData();

        const user = data.users.find(u => u.email === userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.balance < amount) {
            return res.status(400).json({ success: false, message: `Insufficient balance. Available: ${user.balance.toFixed(2)}` });
        }

        // মেথড ভ্যালিডেশন
        const methodExists = data.withMethods.find(m => m.name === method);
        if (!methodExists) {
            return res.status(400).json({ success: false, message: 'Invalid withdraw method' });
        }

        user.balance -= amount;
        const newReq = {
            id: generateId(),
            userEmail,
            method,
            address,
            amount,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        data.withRequests.push(newReq);
        saveData(data);
        res.json({ success: true, message: 'Withdraw request submitted', newBalance: user.balance, requestId: newReq.id });
    } catch (e) {
        console.error('Withdraw error:', e);
        res.status(500).json({ success: false, message: 'Server error during withdraw submission' });
    }
});

// ============================================================
//  ৯. ইউজার: ট্রেড আপডেট
// ============================================================
app.post('/api/user/trade', (req, res) => {
    try {
        const { userEmail, amount, profit } = req.body;
        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }
        let data = loadData();
        const user = data.users.find(u => u.email === userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        user.balance += profit;
        if (user.balance < 0) user.balance = 0;
        saveData(data);
        res.json({ success: true, newBalance: user.balance });
    } catch (e) {
        console.error('Trade update error:', e);
        res.status(500).json({ success: false, message: 'Server error during trade update' });
    }
});

// ============================================================
//  ১০. ইউজার: ব্যালেন্স চেক
// ============================================================
app.post('/api/user/balance', (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        let data = loadData();
        const user = data.users.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, balance: user.balance });
    } catch (e) {
        console.error('Balance check error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
//  ১১. সিস্টেম কনফিগ (Firebase, FAQ, Winning Percentage)
// ============================================================

// 11.1 কনফিগ পাওয়া
app.get('/api/admin/config/:key', (req, res) => {
    try {
        const { key } = req.params;
        let data = loadData();
        if (!data.config) data.config = {};
        if (data.config[key] !== undefined) {
            return res.json({ success: true, value: data.config[key] });
        }
        // ডিফল্ট মান (winning_percentage)
        if (key === 'winning_percentage') {
            return res.json({ success: true, value: 90 });
        }
        res.status(404).json({ success: false, message: 'Config not found' });
    } catch (e) {
        console.error('Get config error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 11.2 কনফিগ সেট করা
app.post('/api/admin/config', (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) {
            return res.status(400).json({ success: false, message: 'Key is required' });
        }
        let data = loadData();
        if (!data.config) data.config = {};
        data.config[key] = value;
        saveData(data);
        res.json({ success: true, config: { key, value } });
    } catch (e) {
        console.error('Set config error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 11.3 কনফিগ ডিলিট
app.delete('/api/admin/config/:key', (req, res) => {
    try {
        const { key } = req.params;
        let data = loadData();
        if (data.config) {
            delete data.config[key];
            saveData(data);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Delete config error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
//  ১২. হেলথ চেক
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        dataFile: DATA_FILE,
        fileExists: fs.existsSync(DATA_FILE)
    });
});

// ============================================================
//  ১৩. রুট
// ============================================================
app.get('/', (req, res) => {
    res.json({
        message: 'Global Trading API (JSON File)',
        version: '3.0.0',
        endpoints: {
            auth: '/api/register, /api/login, /api/google-auth, /api/admin/login',
            admin: '/api/admin/users, /api/admin/depMethods, /api/admin/withMethods, /api/admin/addBalance, /api/admin/pendingRequests, /api/admin/approveRequest',
            user: '/api/user/deposit, /api/user/withdraw, /api/user/trade, /api/user/balance',
            config: '/api/admin/config/:key (GET, POST, DELETE)',
            health: '/api/health'
        }
    });
});

// ============================================================
//  ১৪. ৪০৪ হ্যান্ডলার
// ============================================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// ============================================================
//  ১৫. গ্লোবাল এরর হ্যান্ডলার
// ============================================================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// ============================================================
//  সার্ভার চালু করা
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API URL: http://localhost:${PORT}/api`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📁 Data file: ${DATA_FILE}`);
});