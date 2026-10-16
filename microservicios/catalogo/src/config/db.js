import { connect } from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://catalogo:catalogo@mongo:27017/catalogo?authSource=admin';
    await connect(mongoURI);
    console.log('MongoDB conectado exitosamente');
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

export default connectDB;
