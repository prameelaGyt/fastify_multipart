const fastify = require('fastify')();
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);

fastify.register(require('@fastify/multipart'));

// Import the mongoose library and configure your MongoDB connection
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/upswing_health', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define the Mongoose schema and model
const yourSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  data: Buffer,
});

// Create a Mongoose model based on the schema
const YourModel = mongoose.model('YourModel', yourSchema, 'json_file');

fastify.post('/upload', async function (req, reply) {
  try {
    const data = await req.file();

    if (!data || !data.file) {
      reply.code(400).send({ error: 'No file uploaded' });
      return;
    }

    // Get file information
    const { filename, encoding, mimetype } = data;
    console.log('Received file:', filename);

    // Create a buffer from the file data
    const buffer = await streamToBuffer(data.file);

    // Save the file information and data to MongoDB
    const newDocument = new YourModel({
      filename,
      contentType: mimetype,
      data: buffer,
    });
    await newDocument.save();

    reply.code(201).send({ message: 'File uploaded and saved in MongoDB' });
  } catch (err) {
    console.error('Error handling file upload:', err);
    reply.code(500).send({ error: 'File upload and handling failed' });
  }
});

// Endpoint to list uploaded files
fastify.get('/list_files', async (req, reply) => {
  try {
    const files = await YourModel.find({});
    reply.send(files);
  } catch (err) {
    console.error('Error listing files:', err);
    reply.code(500).send({ error: 'Error listing files' });
  }
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) throw err;
  console.log(`Server listening on ${fastify.server.address().port}`);
});


// Helper function to convert a readable stream to a buffer
async function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}