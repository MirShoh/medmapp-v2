import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedMapp — Medical Tourism Platform", short_name: "MedMapp",
    description: "Treatment abroad and in Uzbekistan: trusted hospitals, doctors and a free coordinator.",
    start_url: "/", display: "standalone", background_color: "#ffffff", theme_color: "#0b2545",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  };
}
