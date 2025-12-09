import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Path to the original nbp_slides project for Python scripts
    PYTHON_SCRIPTS_PATH: process.env.PYTHON_SCRIPTS_PATH || "../nbp_slides/tools",
    NBP_SLIDES_PATH: process.env.NBP_SLIDES_PATH || "../nbp_slides",
  },
  // Allow serving generated images from public folder
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;

