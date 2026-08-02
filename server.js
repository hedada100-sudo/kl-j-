const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ⚠️ এখানে আপনার ফাইনাল মঙ্গোডিবি লিংক বসানো হয়েছে
const DB_URI = 'mongodb+srv://hedada100_db_user:1aFF5PWTjPcFU0MC@cluster0.eu4yill.mongodb.net/TRADE_DB?retryWrites=true&w=majority';

// MongoDB Schema Design
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    phone: String,
    balance: { type: Number, default: 100 }
});
const depMethodSchema = new mongoose.Schema({ name: String, address: String });
const withMethodSchema = new mongoose.Schema({ name: String });

const requestSchema = new mongoose.Schema({
    userEmail: String,
    method: String,
    txid: String,
    address: String,
    amount: Number,
    status: { type: String, default: 'pending' }
});

// Mongoose Models
const User = mongoose.model('User', userSchema);
const DepMethod = mongoose.model('DepMethod', depMethodSchema);
const WithMethod = mongoose.model('WithMethod', withMethodSchema);
const PendingRequest = mongoose.model('PendingRequest', requestSchema);

// MongoDB Connection
mongoose.connect(DB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==================== API ROUTES ====================

// 1. Register
app.post('/api/register', async (req, res) => {
    const { email, password, phone } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.json({ success: false, message: 'User already exists' });
    const newUser = new User({ email, password, phone, balance: 100 });
    await newUser.save();
    res.json({ success: true, user: newUser });
});

// 2. Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
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

// 6. Manual Balance Add (Admin)
app.post('/api/admin/addBalance', async (req, res) => {
    const { email, amount } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: 'User not found' });
    user.balance += amount;
    await user.save();
    res.json({ success: true, user });
});

// 7. Pending Requests & Approval
app.get('/api/admin/pendingRequests', async (req, res) => {
    const depReqs = await PendingRequest.find({ status: 'pending', txid: { $exists: true } });
    const withReqs = await PendingRequest.find({ status: 'pending', address: { $exists: true } });
    res.json({ depRequests: depReqs, withRequests: withReqs });
});
app.post('/api/admin/approveRequest', async (req, res) => {
    const { type, idx, isApprove } = req.body;
    let allDep = await PendingRequest.find({ txid: { $exists: true } });
    let allWith = await PendingRequest.find({ address: { $exists: true } });
    let reqList = type === 'Deposit' ? allDep : allWith;
    
    if (reqList[idx] && reqList[idx].status === 'pending') {
        reqList[idx].status = isApprove ? 'approved' : 'rejected';
        await reqList[idx].save();
        if (isApprove) {
            let user = await User.findOne({ email: reqList[idx].userEmail });
            if (user) {
                user.balance += reqList[idx].amount;
                await user.save();
            }
        }
    }
    res.json({ success: true });
});

// 8. User Deposit
app.post('/api/user/deposit', async (req, res) => {
    const newReq = new PendingRequest({ ...req.body, status: 'pending' });
    await newReq.save();
    res.json({ success: true });
});

// 9. User Withdraw
app.post('/api/user/withdraw', async (req, res) => {
    const { userEmail, method, address, amount } = req.body;
    const user = await User.findOne({ email: userEmail });
    if (!user || user.balance < amount) return res.json({ success: false, message: 'Insufficient balance' });
    user.balance -= amount;
    await user.save();
    const newReq = new PendingRequest({ userEmail, method, address, amount, status: 'pending' });
    await newReq.save();
    res.json({ success: true });
});

// 10. Trade Update
app.post('/api/user/trade', async (req, res) => {
    const { userEmail, amount, profit } = req.body;
    const user = await User.findOne({ email: userEmail });
    if (!user) return res.json({ success: false });
    user.balance += profit;
    await user.save();
    res.json({ success: true, newBalance: user.balance });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
