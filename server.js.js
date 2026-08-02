const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
//  MIDDLEWARE
// ============================================================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============================================================
//  MONGODB CONNECTION
// ============================================================
const DB_URI = 'mongodb+srv://hedada100_db_user:laFF5PmTJpCFUOMC@cluster0.eu4yill.mongodb.net/TRADE_DB?retryWrites=true&w=majority';

mongoose.connect(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
});

// ============================================================
//  SCHEMAS (Data Models)
// ============================================================

// User Schema
const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        unique: true, 
        lowercase: true, 
        trim: true,
        required: [true, 'Email is required'],
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: { 
        type: String, 
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    phone: { 
        type: String, 
        default: '' 
    },
    balance: { 
        type: Number, 
        default: 100,
        min: [0, 'Balance cannot be negative']
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Deposit Method Schema
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

// Withdraw Method Schema
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

// Request Schema (Deposit & Withdraw requests)
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
        min: [1, 'Amount must be at least 1'] 
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

// Models
const User = mongoose.model('User', userSchema);
const DepMethod = mongoose.model('DepMethod', depMethodSchema);
const WithMethod = mongoose.model('WithMethod', withMethodSchema);
const PendingRequest = mongoose.model('PendingRequest', requestSchema);

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================

// Validate amount (reject scientific notation & huge numbers)
function isValidAmount(amount) {
    if (typeof amount !== 'number' || !isFinite(amount)) return false;
    if (amount <= 0 || amount > 1e12) return false;
    // Check if it's a valid decimal number (not scientific notation)
    const str = String(amount);
    if (str.includes('e') || str.includes('E')) return false;
    return true;
}

// ============================================================
//  API ROUTES
// ============================================================

// -------------------- AUTH --------------------

// 1. Register
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, phone } = req.body;
        
        // Validation
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

        // Check if user already exists
        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) {
            return res.status(409).json({ 
                success: false, 
                message: 'User already exists' 
            });
        }

        // Create new user with 100 USDT bonus
        const newUser = new User({
            email: email.toLowerCase(),
            password,
            phone: phone || '',
            balance: 100
        });
        await newUser.save();

        // Return user without password
        const userToReturn = newUser.toObject();
        delete userToReturn.password;

        res.status(201).json({ 
            success: true, 
            user: userToReturn 
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

// 2. Login
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

        // Return user without password
        const userToReturn = user.toObject();
        delete userToReturn.password;

        res.json({ 
            success: true, 
            user: userToReturn 
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

// 3. Admin Login
app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        if (password === 'amitop@11') {
            return res.json({ success: true });
        }
        res.status(401).json({ success: false, message: 'Invalid admin password' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- DEPOSIT METHODS --------------------

// 4. Get all deposit methods
app.get('/api/admin/depMethods', async (req, res) => {
    try {
        const methods = await DepMethod.find().sort({ createdAt: -1 });
        res.json(methods);
    } catch (error) {
        console.error('Error fetching deposit methods:', error);
        res.status(500).json([]);
    }
});

// 5. Add deposit method
app.post('/api/admin/depMethods', async (req, res) => {
    try {
        const { name, address } = req.body;
        
        if (!name || !address) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name and address are required' 
            });
        }

        // Check duplicate
        const exists = await DepMethod.findOne({ name });
        if (exists) {
            return res.status(409).json({ 
                success: false, 
                message: 'Method already exists' 
            });
        }

        const newMethod = new DepMethod({ name: name.trim(), address: address.trim() });
        await newMethod.save();
        res.json({ success: true, method: newMethod });

    } catch (error) {
        console.error('Error adding deposit method:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 6. Delete deposit method
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
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- WITHDRAW METHODS --------------------

// 7. Get all withdraw methods
app.get('/api/admin/withMethods', async (req, res) => {
    try {
        const methods = await WithMethod.find().sort({ createdAt: -1 });
        res.json(methods);
    } catch (error) {
        console.error('Error fetching withdraw methods:', error);
        res.status(500).json([]);
    }
});

// 8. Add withdraw method
app.post('/api/admin/withMethods', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name is required' 
            });
        }

        // Check duplicate
        const exists = await WithMethod.findOne({ name });
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
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 9. Delete withdraw method
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
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- MANUAL BALANCE ADD --------------------

// 10. Add balance manually (Admin)
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
                message: 'Invalid amount. Please enter a positive number (e.g., 100, 50.5). Scientific notation not allowed.' 
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

// -------------------- REQUESTS (Deposit & Withdraw) --------------------

// 11. Get all requests (Admin)
app.get('/api/admin/pendingRequests', async (req, res) => {
    try {
        const requests = await PendingRequest.find().sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json([]);
    }
});

// 12. Approve or Reject a request (Admin)
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

        // Update status
        reqDoc.status = isApprove ? 'approved' : 'rejected';
        reqDoc.updatedAt = new Date();
        await reqDoc.save();

        // If approved deposit, add balance to user
        if (isApprove && reqDoc.type === 'deposit') {
            const user = await User.findOne({ email: reqDoc.userEmail.toLowerCase() });
            if (user) {
                user.balance += reqDoc.amount;
                await user.save();
            }
        }

        res.json({ 
            success: true, 
            message: `Request ${isApprove ? 'approved' : 'rejected'} successfully` 
        });

    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// -------------------- USER ACTIONS --------------------

// 13. User submits a deposit request
app.post('/api/user/deposit', async (req, res) => {
    try {
        const { userEmail, method, txid, amount } = req.body;

        // Validation
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

        // Check if user exists
        const user = await User.findOne({ email: userEmail.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Create pending request
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
            message: 'Deposit request submitted successfully',
            requestId: newReq._id 
        });

    } catch (error) {
        console.error('Error submitting deposit:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 14. User submits a withdraw request
app.post('/api/user/withdraw', async (req, res) => {
    try {
        const { userEmail, method, address, amount } = req.body;

        // Validation
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
                message: 'Minimum withdraw amount is 50 USDT' 
            });
        }

        // Check user and balance
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
                message: `Insufficient balance. Available: ${user.balance.toFixed(2)} USDT` 
            });
        }

        // Deduct balance immediately
        user.balance -= amount;
        await user.save();

        // Create pending request
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
            message: 'Withdraw request submitted successfully',
            newBalance: user.balance,
            requestId: newReq._id 
        });

    } catch (error) {
        console.error('Error submitting withdraw:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 15. Update user balance after trade
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

        // Update balance (profit can be negative for loss)
        user.balance += profit;
        if (user.balance < 0) user.balance = 0;
        await user.save();

        res.json({ 
            success: true, 
            newBalance: user.balance 
        });

    } catch (error) {
        console.error('Error updating trade balance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 16. Get user balance
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

        res.json({ 
            success: true, 
            balance: user.balance 
        });

    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// -------------------- HEALTH CHECK --------------------

// 17. Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// 18. Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to Global Trading API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/register, /api/login, /api/admin/login',
            admin: '/api/admin/depMethods, /api/admin/withMethods, /api/admin/addBalance, /api/admin/pendingRequests, /api/admin/approveRequest',
            user: '/api/user/deposit, /api/user/withdraw, /api/user/trade, /api/user/balance'
        }
    });
});

// -------------------- 404 HANDLER --------------------

app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'API endpoint not found' 
    });
});

// -------------------- ERROR HANDLER --------------------

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
    console.log(`📊 MongoDB status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
});