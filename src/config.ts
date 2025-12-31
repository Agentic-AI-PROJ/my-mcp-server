import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    WEATHER_API_KEY: z.string().min(1, "WEATHER_API_KEY is required"),
    PORT: z.string().default("3010"),
});

const env = envSchema.parse(process.env);

export const CONFIG = {
    WEATHER_API_KEY: env.WEATHER_API_KEY,
    PORT: parseInt(env.PORT, 10),
};
