// Environment configuration
import dotenv from "dotenv";

// Environment variables
dotenv.config();

interface EnvConfig {
  PORT: number;
  NODE_ENV: string | undefined;
  JWT_ACCESS_SECRET:string | undefined;
  JWT_REFRESH_SECRET:string | undefined;
  MONGODB_URI:string | undefined;
  SALT_ROUNDS:string | undefined;
  ALLOWEDDOMAIN:string | undefined;
  CLOUDINARY_SECRET:string | undefined;
  CLOUDINARY_KEY:string | undefined;
  CLOUDINARY_NAME:string | undefined;
  CLOUDINARY_URL:string | undefined;
  CLIENT_URL:string | undefined;
  PAYPAL_CLIENT_ID:string | undefined;
  PAYPAL_CLIENT_SECRET:string | undefined;
  PAYPAL_MODE:string | undefined;
  REDIS_URL:string | undefined;
}

const env: EnvConfig = {
  NODE_ENV: process.env.NODE_ENV,
  PORT:
    process.env.PORT && Number.isFinite(+process.env.PORT) && +process.env.PORT > 0
      ? +process.env.PORT!
      : 5000,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  MONGODB_URI: process.env.MONGODB_URI,
  SALT_ROUNDS: process.env.SALT_ROUNDS,
  ALLOWEDDOMAIN: process.env.ALLOWEDDOMAIN,
  CLOUDINARY_SECRET: process.env.CLOUDINARY_SECRET,
  CLOUDINARY_KEY: process.env.CLOUDINARY_KEY,
  CLOUDINARY_NAME: process.env.CLOUDINARY_NAME,
  CLOUDINARY_URL: process.env.CLOUDINARY_URL,
  CLIENT_URL:
    process.env.CLIENT_URL || "http://localhost:3000/checkout/success",
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
  PAYPAL_MODE: process.env.PAYPAL_MODE,
  REDIS_URL: process.env.REDIS_URL,
};

export default env;
