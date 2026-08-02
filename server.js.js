const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// আপনার MongoDB URI (সঠিক)
const DB_URI = 'mongodb+srv://hedada100_db_user:laFF5PmTJpCFUOMC@cluster0.eu4yill.mongodb.net/TRADE_DB?retryWrites=true&w=majority';

// Schemas
const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, lowercase: true },
    password: String,
    phone: String,
    balance: { type: Number, default: 100 }
});
const depMethodSchema = new mongoose.Schema({ name: String, address: String });
const withMethodSchema = new mongoose.Schema({ name: String });
const requestSchema = new mongoose.Schema({
    userEmail: { type: String, lowercase: true },
    method: String,
    txid: String,
    address: String,
    amount: Number,
    type: String, // 'deposit' or 'withdraw'
    status: { type: String, default: 'pending' } // pending, approved, rejected
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const DepMethod = mongoose.model('DepMethod', depMethodSchema);
const WithMethod = mongoose.model('WithMethod', withMethodSchema);
const PendingRequest = mongoose.model('PendingRequest', requestSchema);

mongoose.connect(DB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==================== API ROUTES ====================

// 1. Register
app.post('/api/register', async (req, res) => {
    const { email, password, phone } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.json({ success: false, message: 'User already exists' });
    const newUser = new User({ email: email.toLowerCase(), password, phone, balance: 100 });
    await newUser.save();
    res.json({ success: true, user: newUser });
});

// 2. Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), password });
    if (!user) return res.json({ success: false, message: 'Invalid credentials' });
    res.json({ success: true, user });
});

// 3. Admin Login
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === 'amitop@11') return res.json({ success: true });
    res.json({ success: false });
});

// 4. Deposit Methods
app.get('/api/admin/depMethods', async (req, res) => {
    const methods = await DepMethod.find();
    res.json(methods);
});
app.post('/api/admin/depMethods', async (req, res) => {
    const newMethod = new DepMethod(req.body);
    await newMethod.save();
    res.json({ success: true });
});
app.delete('/api/admin/depMethods', async (req, res) => {
    await DepMethod.findOneAndDelete({ name: req.body.name });
    res.json({ success: true });
});

// 5. Withdraw Methods
app.get('/api/admin/withMethods', async (req, res) => {
    const methods = await WithMethod.find();
    res.json(methods);
});
app.post('/api/admin/withMethods', async (req, res) => {
    const newMethod = new WithMethod(req.body);
    await newMethod.save();
    res.json({ success: true });
});
app.delete('/api/admin/withMethods', async (req, res) => {
    await WithMethod.findOneAndDelete({ name: req.body.name });
    res.json({ success: true });
});

// 6. Manual Balance Add (FIXED - case insensitive)
app.post('/api/admin/addBalance', async (req, res) => {
    const { email, amount } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ success: false, message: 'User not found' });
    user.balance += amount;
    await user.save();
    res.json({ success: true, user });
});

// 7. Get ALL Requests (for admin)
app.get('/api/admin/pendingRequests', async (req, res) => {
    const requests = await PendingRequest.find().sort({ createdAt: -1 });
    res.json(requests);
});

// 8. Approve/Reject Request
app.post('/api/admin/approveRequest', async (req, res) => {
    const { requestId, isApprove } = req.body;
    const reqDoc = await PendingRequest.findById(requestId);
    if (!reqDoc) return res.json({ success: false, message: 'Request not found' });
    if (reqDoc.status !== 'pending') return res.json({ success: false, message: 'Already processed' });
    reqDoc.status = isApprove ? 'approved' : 'rejected';
    await reqDoc.save();
    if (isApprove && reqDoc.type === 'deposit') {
        const user = await User.findOne({ email: reqDoc.userEmail.toLowerCase() });
        if (user) {
            user.balance += reqDoc.amount;
            await user.save();
        }
    }
    res.json({ success: true });
});

// 9. User Deposit
app.post('/api/user/deposit', async (req, res) => {
    const { userEmail, method, txid, amount } = req.body;
    const newReq = new PendingRequest({
        userEmail: userEmail.toLowerCase(),
        method,
        txid,
        amount,
        type: 'deposit',
        status: 'pending'
    });
    await newReq.save();
    res.json({ success: true });
});

// 10. User Withdraw
app.post('/api/user/withdraw', async (req, res) => {
    const { userEmail, method, address, amount } = req.body;
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    if (!user || user.balance < amount) {
        return res.json({ success: false, message: 'Insufficient balance' });
    }
    user.balance -= amount;
    await user.save();
    const newReq = new PendingRequest({
        userEmail: userEmail.toLowerCase(),
        method,
        address,
        amount,
        type: 'withdraw',
        status: 'pending'
    });
    await newReq.save();
    res.json({ success: true, newBalance: user.balance });
});

// 11. Trade Update
app.post('/api/user/trade', async (req, res) => {
    const { userEmail, amount, profit } = req.body;
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    if (!user) return res.json({ success: false });
    user.balance += profit;
    await user.save();
    res.json({ success: true, newBalance: user.balance });
});

// 12. Get User Balance
app.post('/api/user/balance', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ success: false });
    res.json({ success: true, balance: user.balance });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});