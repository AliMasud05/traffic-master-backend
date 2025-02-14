require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const port = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.DATABASE_URL;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

async function run() {
  try {
    const questionCollection = client.db("traffic-master").collection("questions");
    const adminCollection = client.db("traffic-master").collection("admins");

    // Admin Login
    app.post("/admin/login", async (req, res) => {
      const { username, password } = req.body;
      const admin = await adminCollection.findOne({ username });
      if (!admin) {
        return res.status(404).json({ error: "Admin not found" });
      }
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid password" });
      }
      const token = jwt.sign({ username: admin.username, role: "admin" }, JWT_SECRET, {
        expiresIn: "1h",
      });
      res.json({ token });
    });

    // Create Admin
    app.post("/admin/create", verifyAdmin, async (req, res) => {
      try {
        const { username, password, role } = req.body;
        const existingAdmin = await adminCollection.findOne({ username });
        if (existingAdmin) {
          return res.status(400).json({ error: "Admin already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = { username, password: hashedPassword, role };
        const result = await adminCollection.insertOne(newAdmin);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to create admin" });
      }
    });

    // Get all Admins
    app.get("/admin/all", verifyAdmin, async (req, res) => {
      try {
        const admins = await adminCollection.find().toArray();
        res.json(admins);
      } catch (error) {
        res.status(500).json({ error: "Failed to retrieve admins" });
      }
    });

    // Delete Admin
    app.delete("/admin/delete/:id", verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await adminCollection.deleteOne({ _id: new ObjectId(id) });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to delete admin" });
      }
    });

    // Update Admin Password
    app.put("/admin/update-password", verifyAdmin, async (req, res) => {
      try {
        const { username, newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const result = await adminCollection.updateOne(
          { username },
          { $set: { password: hashedPassword } }
        );
        res.json({ message: "Password updated successfully" });
      } catch (error) {
        res.status(500).json({ error: "Failed to update password" });
      }
    });

    // Forgot Password
    app.post("/admin/forgot-password", async (req, res) => {
      try {
        const { username, newPassword } = req.body;
        const admin = await adminCollection.findOne({ username });
        if (!admin) {
          return res.status(404).json({ error: "Admin not found" });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const result = await adminCollection.updateOne(
          { username },
          { $set: { password: hashedPassword } }
        );
        res.json({ message: "Password reset successfully" });
      } catch (error) {
        res.status(500).json({ error: "Failed to reset password" });
      }
    });

    // Add Question with Options
    app.post("/questions/add-question", verifyAdmin, async (req, res) => {
    
    console.log(req.body);
      try {
        const { question, topic, imageUrl, correctOption } = req.body;

        // Convert options from indexed fields into an array
        const options = Object.keys(req.body)
          .filter((key) => key.startsWith("options["))
          .sort((a, b) => {
            // Sort by index like "options[0]", "options[1]"
            return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]);
          })
          .map((key) => req.body[key]);
    
        const newQuestion = {
          question,
          options,
          answer: correctOption,
          topics: topic,
          image: imageUrl,
        };
    
          const result = await questionCollection.insertOne(newQuestion);
        res.json(result);
        console.log(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to add question" });
      }
    });

    // Update Question
    app.put("/questions/update-question/:id", verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const { text, options, correctOption } = req.body;
        const updatedQuestion = { text, options, correctOption };
        const result = await questionCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedQuestion }
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to update question" });
      }
    });

    // Delete Question
    app.delete("/questions/delete-question/:id", verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await questionCollection.deleteOne({ _id: new ObjectId(id) });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to delete question" });
      }
    });

    // Get all Questions
    app.get("/questions/all-questions", async (req, res) => {
      try {
        const result = await questionCollection.find().toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to retrieve questions" });
      }
    });

    app.listen(port, () => console.log(`Traffic Master running on ${port}`));
  } catch (error) {
    console.error("Error in running MongoDB operations:", error);
  }
}

run().catch(console.log);