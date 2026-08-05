const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============================================================
//  MONGODB URI (আপনার নিজের URI দিন)
// ============================================================
const DB_URI = 'mongodb+srv://hedada100_db_user:laFF5PmTJpCFUOMC@cluster0.eu4yill.mongodb.net/TRADE_DB?retryWrites=true&w=majority';

// ============================================================
//  SCHEMAS (সব মডেল)
// ============================================================

// --- 1. User Schema ---
const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        unique: true, 
        lowercase: true, 
        trim: true, 
        required: [true, 'Email is required'] 
    },
    password: { 
        type: String, 
        default: null 
    },
    phone: { 
        type: String, 
        default: '' 
    },
    balance: { 
        type: Number, 
        default: 100 
    },
    isGoogle: { 
        type: Boolean, 
        default: false 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// --- 2. Deposit Method Schema ---
const depMethodSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true, 
        unique: true 
    },
    address: { 
        type: String, 
        required: true, 
        trim: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// --- 3. Withdraw Method Schema ---
const withMethodSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true, 
        unique: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// --- 4. Pending Request Schema (Deposit/Withdraw) ---
const requestSchema = new mongoose.Schema({
    userEmail: { 
        type: String, 
        lowercase: true, 
        trim: true, 
        required: true 
    },
    method: { 
        type: String, 
        required: true 
    },
    txid: { 
        type: String, 
        default: '' 
    },
    address: { 
        type: String, 
        default: '' 
    },
    amount: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    type: { 
        type: String, 
        enum: ['deposit', 'withdraw'], 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// --- 5. System Config Schema (Firebase, FAQ, Winning Percentage, SEO) ---
const configSchema = new mongoose.Schema({
    key: { 
        type: String, 
        unique: true, 
        required: true 
    },
    value: { 
        type: mongoose.Schema.Types.Mixed, 
        required: true 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// --- 6. Sub-Admin Schema ---
const subAdminSchema = new mongoose.Schema({
    email: { 
        type: String, 
        unique: true, 
        lowercase: true, 
        trim: true, 
        required: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    balance: { 
        type: Number, 
        default: 0 
    },
    createdBy: { 
        type: String, 
        lowercase: true, 
        trim: true, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// --- 7. Transaction Log Schema (সাব-অ্যাডমিনের হিস্ট্রি) ---
const transactionLogSchema = new mongoose.Schema({
    subAdminEmail: { 
        type: String, 
        lowercase: true, 
        trim: true, 
        required: true 
    },
    userEmail: { 
        type: String, 
        lowercase: true, 
        trim: true, 
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    beforeBalance: { 
        type: Number, 
        required: true 
    },
    afterBalance: { 
        type: Number, 
        required: true 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

// ============================================================
//  MODELS
// ============================================================
const User = mongoose.model('User', userSchema);
const DepMethod = mongoose.model('DepMethod', depMethodSchema);
const WithMethod = mongoose.model('WithMethod', withMethodSchema);
const PendingRequest = mongoose.model('PendingRequest', requestSchema);
const Config = mongoose.model('Config', configSchema);
const SubAdmin = mongoose.model('SubAdmin', subAdminSchema);
const TransactionLog = mongoose.model('TransactionLog', transactionLogSchema);

// ============================================================
//  MONGODB CONNECTION
// ============================================================
mongoose.connect(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
});

// ============================================================
//  UTILITY FUNCTION
// ============================================================
function isValidAmount(amount) {
    if (typeof amount !== 'number' || !isFinite(amount)) return false;
    if (amount <= 0 || amount > 1e12) return false;
    return true;
}

// ============================================================
//  API ROUTES
// ============================================================

// ---------- 1. AUTHENTICATION ----------

// 1.1 Register (Email/Password)
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, phone } = req.body;
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters' 
            });
        }
        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) {
            return res.status(409).json({ 
                success: false, 
                message: 'User already exists' 
            });
        }
        const newUser = new User({
            email: email.toLowerCase(),
            password,
            phone: phone || '',
            balance: 100,
            isGoogle: false
        });
        await newUser.save();
        const userToReturn = newUser.toObject();
        delete userToReturn.password;
        res.status(201).json({ success: true, user: userToReturn });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                success: false, 
                message: Object.values(error.errors).map(e => e.message).join('. ') 
            });
        }
        if (error.code === 11000) {
            return res.status(409).json({ 
                success: false, 
                message: 'Email already registered' 
            });
        }
        console.error('Registration Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

// 1.2 Login (Email/Password)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }
        const user = await User.findOne({ 
            email: email.toLowerCase(), 
            password 
        });
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        const userToReturn = user.toObject();
        delete userToReturn.password;
        res.json({ success: true, user: userToReturn });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

// 1.3 Google Auth (Firebase থেকে আসা ডেটা)
app.post('/api/google-auth', async (req, res) => {
    try {
        const { email, name, uid } = req.body;
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            const userToReturn = user.toObject();
            delete userToReturn.password;
            return res.json({ success: true, user: userToReturn });
        }
        const newUser = new User({
            email: email.toLowerCase(),
            password: null,
            phone: name || '',
            balance: 100,
            isGoogle: true
        });
        await newUser.save();
        const userToReturn = newUser.toObject();
        delete userToReturn.password;
        res.status(201).json({ success: true, user: userToReturn });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during Google authentication' 
        });
    }
});

// 1.4 Admin Login
app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        if (password === 'amitop@11') {
            return res.json({ success: true });
        }
        res.status(401).json({ 
            success: false, 
            message: 'Invalid admin password' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// ---------- 2. ADMIN: USERS ----------

app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find({}, { 
            email: 1, 
            balance: 1, 
            createdAt: 1, 
            isGoogle: 1, 
            _id: 1 
        }).sort({ createdAt: -1 });
        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching users' 
        });
    }
});

// ---------- 3. ADMIN: DEPOSIT METHODS ----------

app.get('/api/admin/depMethods', async (req, res) => {
    try {
        const methods = await DepMethod.find().sort({ createdAt: -1 });
        res.json(methods);
    } catch (error) {
        console.error('Error fetching deposit methods:', error);
        res.status(500).json([]);
    }
});

app.post('/api/admin/depMethods', async (req, res) => {
    try {
        const { name, address } = req.body;
        if (!name || !address) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name and address are required' 
            });
        }
        const exists = await DepMethod.findOne({ name: name.trim() });
        if (exists) {
            return res.status(409).json({ 
                success: false, 
                message: 'Method already exists' 
            });
        }
        const newMethod = new DepMethod({ 
            name: name.trim(), 
            address: address.trim() 
        });
        await newMethod.save();
        res.json({ success: true, method: newMethod });
    } catch (error) {
        console.error('Error adding deposit method:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

app.delete('/api/admin/depMethods', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Method name is required' 
            });
        }
        const result = await DepMethod.findOneAndDelete({ name: name.trim() });
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                message: 'Method not found' 
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting deposit method:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// ---------- 4. ADMIN: WITHDRAW METHODS ----------

app.get('/api/admin/withMethods', async (req, res) => {
    try {
        const methods = await WithMethod.find().sort({ createdAt: -1 });
        res.json(methods);
    } catch (error) {
        console.error('Error fetching withdraw methods:', error);
        res.status(500).json([]);
    }
});

app.post('/api/admin/withMethods', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name is required' 
            });
        }
        const exists = await WithMethod.findOne({ name: name.trim() });
        if (exists) {
            return res.status(409).json({ 
                success: false, 
                message: 'Method already exists' 
            });
        }
        const newMethod = new WithMethod({ name: name.trim() });
        await newMethod.save();
        res.json({ success: true, method: newMethod });
    } catch (error) {
        console.error('Error adding withdraw method:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

app.delete('/api/admin/withMethods', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Method name is required' 
            });
        }
        const result = await WithMethod.findOneAndDelete({ name: name.trim() });
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                message: 'Method not found' 
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting withdraw method:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// ---------- 5. ADMIN: MANUAL BALANCE ADD ----------

app.post('/api/admin/addBalance', async (req, res) => {
    try {
        const { email, amount } = req.body;
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }
        if (!isValidAmount(amount)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        user.balance += amount;
        await user.save();
        res.json({ 
            success: true, 
            user: { email: user.email, balance: user.balance } 
        });
    } catch (error) {
        console.error('Error adding balance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// ---------- 6. ADMIN: PENDING REQUESTS ----------

app.get('/api/admin/pendingRequests', async (req, res) => {
    try {
        const requests = await PendingRequest.find().sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json([]);
    }
});

app.post('/api/admin/approveRequest', async (req, res) => {
    try {
        const { requestId, isApprove } = req.body;
        if (!requestId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Request ID is required' 
            });
        }
        const reqDoc = await PendingRequest.findById(requestId);
        if (!reqDoc) {
            return res.status(404).json({ 
                success: false, 
                message: 'Request not found' 
            });
        }
        if (reqDoc.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: 'Request already processed' 
            });
        }
        reqDoc.status = isApprove ? 'approved' : 'rejected';
        reqDoc.updatedAt = new Date();
        await reqDoc.save();
        if (isApprove && reqDoc.type === 'deposit') {
            const user = await User.findOne({ email: reqDoc.userEmail.toLowerCase() });
            if (user) {
                user.balance += reqDoc.amount;
                await user.save();
            }
        }
        res.json({ 
            success: true, 
            message: `Request ${isApprove ? 'approved' : 'rejected'}` 
        });
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// ---------- 7. USER: DEPOSIT ----------

app.post('/api/user/deposit', async (req, res) => {
    try {
        const { userEmail, method, txid, amount } = req.body;
        if (!userEmail || !method || !txid || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        if (!isValidAmount(amount)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }
        const user = await User.findOne({ email: userEmail.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        const methodExists = await DepMethod.findOne({ name: method });
        if (!methodExists) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid deposit method' 
            });
        }
        const newReq = new PendingRequest({
            userEmail: userEmail.toLowerCase(),
            method: method.trim(),
            txid: txid.trim(),
            amount,
            type: 'deposit',
            status: 'pending'
        });
        await newReq.save();
        res.json({ 
            success: true, 
            message: 'Deposit request submitted', 
            requestId: newReq._id 
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during deposit submission' 
        });
    }
});

// ---------- 8. USER: WITHDRAW ----------

app.post('/api/user/withdraw', async (req, res) => {
    try {
        const { userEmail, method, address, amount } = req.body;
        if (!userEmail || !method || !address || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        if (!isValidAmount(amount)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }
        if (amount < 50) {
            return res.status(400).json({ 
                success: false, 
                message: 'Minimum withdraw is 50 USDT' 
            });
        }
        const user = await User.findOne({ email: userEmail.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        if (user.balance < amount) {
            return res.status(400).json({ 
                success: false, 
                message: `Insufficient balance. Available: ${user.balance.toFixed(2)}` 
            });
        }
        const methodExists = await WithMethod.findOne({ name: method });
        if (!methodExists) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid withdraw method' 
            });
        }
        user.balance -= amount;
        await user.save();
        const newReq = new PendingRequest({
            userEmail: userEmail.toLowerCase(),
            method: method.trim(),
            address: address.trim(),
            amount,
            type: 'withdraw',
            status: 'pending'
        });
        await newReq.save();
        res.json({ 
            success: true, 
            message: 'Withdraw request submitted', 
            newBalance: user.balance, 
            requestId: newReq._id 
        });
    } catch (error) {
        console.error('Withdraw error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during withdraw submission' 
        });
    }
});

// ---------- 9. USER: TRADE UPDATE ----------

app.post('/api/user/trade', async (req, res) => {
    try {
        const { userEmail, amount, profit } = req.body;
        if (!userEmail) {
            return res.status(400).json({ 
                success: false, 
                message: 'User email is required' 
            });
        }
        const user = await User.findOne({ email: userEmail.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        user.balance += profit;
        if (user.balance < 0) user.balance = 0;
        await user.save();
        res.json({ success: true, newBalance: user.balance });
    } catch (error) {
        console.error('Trade update error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during trade update' 
        });
    }
});

// ---------- 10. USER: BALANCE CHECK ----------

app.post('/api/user/balance', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        res.json({ success: true, balance: user.balance });
    } catch (error) {
        console.error('Balance check error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// ---------- 11. SYSTEM CONFIG (SEO, Firebase, FAQ, Winning Percentage) ----------

app.get('/api/admin/config/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const config = await Config.findOne({ key });
        if (!config) {
            if (key === 'winning_percentage') {
                return res.json({ success: true, value: 90 });
            }
            if (key === 'seo_data') {
                return res.json({ success: true, value: { keywords: [], links: [] } });
            }
            return res.status(404).json({ 
                success: false, 
                message: 'Config not found' 
            });
        }
        res.json({ success: true, value: config.value });
    } catch (error) {
        console.error('Error fetching config:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

app.post('/api/admin/config', async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) {
            return res.status(400).json({ 
                success: false, 
                message: 'Key is required' 
            });
        }
        const config = await Config.findOneAndUpdate(
            { key },
            { value, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true, config });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

app.delete('/api/admin/config/:key', async (req, res) => {
    try {
        const { key } = req.params;
        await Config.findOneAndDelete({ key });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting config:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// ---------- 12. SUB-ADMIN API (সম্পূর্ণ) ----------

// 12.1 সাব-অ্যাডমিন রেজিস্টার (শুধু মূল অ্যাডমিন করবে)
app.post('/api/sub-admin/register', async (req, res) => {
    try {
        const { email, password, createdBy } = req.body;
        if (!email || !password || !createdBy) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, password and createdBy are required' 
            });
        }
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters' 
            });
        }
        const exists = await SubAdmin.findOne({ email: email.toLowerCase() });
        if (exists) {
            return res.status(409).json({ 
                success: false, 
                message: 'Sub-admin already exists' 
            });
        }
        const newSub = new SubAdmin({
            email: email.toLowerCase(),
            password,
            balance: 0,
            createdBy: createdBy.toLowerCase()
        });
        await newSub.save();
        res.status(201).json({ 
            success: true, 
            message: 'Sub-admin created successfully', 
            subAdmin: { email: newSub.email, balance: newSub.balance } 
        });
    } catch (error) {
        console.error('Sub-admin registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 12.2 সাব-অ্যাডমিন লগইন
app.post('/api/sub-admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }
        const sub = await SubAdmin.findOne({ email: email.toLowerCase(), password });
        if (!sub) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        res.json({ 
            success: true, 
            subAdmin: { email: sub.email, balance: sub.balance, createdBy: sub.createdBy } 
        });
    } catch (error) {
        console.error('Sub-admin login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 12.3 সাব-অ্যাডমিনের নিজের ব্যালেন্স দেখানো
app.get('/api/sub-admin/balance/:email', async (req, res) => {
    try {
        const { email } = req.params;
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }
        const sub = await SubAdmin.findOne({ email: email.toLowerCase() });
        if (!sub) {
            return res.status(404).json({ 
                success: false, 
                message: 'Sub-admin not found' 
            });
        }
        res.json({ success: true, balance: sub.balance });
    } catch (error) {
        console.error('Error fetching sub-admin balance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 12.4 সাব-অ্যাডমিনের ব্যালেন্স আপডেট (শুধু মূল অ্যাডমিন)
app.post('/api/sub-admin/update-balance', async (req, res) => {
    try {
        const { email, amount, adminEmail } = req.body;
        if (!email || !amount || !adminEmail) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, amount and adminEmail are required' 
            });
        }
        if (!isValidAmount(amount)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }
        const sub = await SubAdmin.findOne({ email: email.toLowerCase() });
        if (!sub) {
            return res.status(404).json({ 
                success: false, 
                message: 'Sub-admin not found' 
            });
        }
        const beforeBalance = sub.balance;
        sub.balance += amount;
        await sub.save();
        // লগ তৈরি করুন
        const log = new TransactionLog({
            subAdminEmail: email.toLowerCase(),
            userEmail: 'SYSTEM',
            amount: amount,
            beforeBalance: beforeBalance,
            afterBalance: sub.balance
        });
        await log.save();
        res.json({ success: true, newBalance: sub.balance });
    } catch (error) {
        console.error('Error updating sub-admin balance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 12.5 সাব-অ্যাডমিনের ট্রান্সঅ্যাকশন হিস্ট্রি
app.get('/api/sub-admin/history/:email', async (req, res) => {
    try {
        const { email } = req.params;
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }
        const logs = await TransactionLog.find({ 
            subAdminEmail: email.toLowerCase() 
        }).sort({ timestamp: -1 });
        res.json({ success: true, history: logs });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 12.6 সাব-অ্যাডমিনের ইউজার লিস্ট (যাদের ব্যালেন্স অ্যাড করেছে)
app.get('/api/sub-admin/users/:email', async (req, res) => {
    try {
        const { email } = req.params;
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }
        const logs = await TransactionLog.find({ 
            subAdminEmail: email.toLowerCase() 
        });
        const userEmails = [...new Set(logs.map(l => l.userEmail))];
        const users = await User.find(
            { email: { $in: userEmails } }, 
            { email: 1, balance: 1, _id: 0 }
        );
        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching sub-admin users:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 12.7 সাব-অ্যাডমিন ব্যালেন্স অ্যাড (ইউজারকে)
app.post('/api/sub-admin/add-balance', async (req, res) => {
    try {
        const { subAdminEmail, userEmail, amount } = req.body;
        if (!subAdminEmail || !userEmail || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        if (!isValidAmount(amount)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }
        const sub = await SubAdmin.findOne({ email: subAdminEmail.toLowerCase() });
        if (!sub) {
            return res.status(404).json({ 
                success: false, 
                message: 'Sub-admin not found' 
            });
        }
        // চেক করুন সাব-অ্যাডমিনের কাছে পর্যাপ্ত ব্যালেন্স আছে কিনা
        if (sub.balance < amount) {
            return res.status(400).json({ 
                success: false, 
                message: `Insufficient balance. Available: ${sub.balance.toFixed(2)}` 
            });
        }
        // ইউজার খুঁজুন
        let user = await User.findOne({ email: userEmail.toLowerCase() });
        if (!user) {
            // ইউজার না থাকলে তৈরি করুন (ডিফল্ট ব্যালেন্স ০)
            user = new User({ 
                email: userEmail.toLowerCase(), 
                password: null, 
                phone: '', 
                balance: 0, 
                isGoogle: false 
            });
            await user.save();
        }
        // সাব-অ্যাডমিনের ব্যালেন্স কমান
        const beforeBalance = sub.balance;
        sub.balance -= amount;
        await sub.save();
        // ইউজারের ব্যালেন্স বাড়ান
        user.balance += amount;
        await user.save();
        // লগ তৈরি করুন
        const log = new TransactionLog({
            subAdminEmail: subAdminEmail.toLowerCase(),
            userEmail: userEmail.toLowerCase(),
            amount: amount,
            beforeBalance: beforeBalance,
            afterBalance: sub.balance
        });
        await log.save();
        res.json({ 
            success: true, 
            newSubBalance: sub.balance, 
            userBalance: user.balance 
        });
    } catch (error) {
        console.error('Error adding balance by sub-admin:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 12.8 সব সাব-অ্যাডমিনের লিস্ট (মূল অ্যাডমিনের জন্য)
app.get('/api/sub-admin/list', async (req, res) => {
    try {
        const subs = await SubAdmin.find({}, { 
            email: 1, 
            balance: 1, 
            createdBy: 1, 
            createdAt: 1 
        });
        res.json({ success: true, subAdmins: subs });
    } catch (error) {
        console.error('Error fetching sub-admin list:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// ---------- 13. HEALTH CHECK ----------

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ---------- 14. ROOT ----------

app.get('/', (req, res) => {
    res.json({
        message: 'Global Trading API (MongoDB)',
        version: '4.0.0',
        endpoints: {
            auth: '/api/register, /api/login, /api/google-auth, /api/admin/login',
            admin: '/api/admin/users, /api/admin/depMethods, /api/admin/withMethods, /api/admin/addBalance, /api/admin/pendingRequests, /api/admin/approveRequest',
            user: '/api/user/deposit, /api/user/withdraw, /api/user/trade, /api/user/balance',
            config: '/api/admin/config/:key (GET, POST, DELETE)',
            subAdmin: '/api/sub-admin/register, /api/sub-admin/login, /api/sub-admin/balance/:email, /api/sub-admin/update-balance, /api/sub-admin/history/:email, /api/sub-admin/users/:email, /api/sub-admin/add-balance, /api/sub-admin/list',
            health: '/api/health'
        }
    });
});

// ---------- 15. 404 HANDLER ----------

app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'API endpoint not found' 
    });
});

// ---------- 16. GLOBAL ERROR HANDLER ----------

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// ============================================================
//  START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API URL: http://localhost:${PORT}/api`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
});