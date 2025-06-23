
import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false); // Default to false (desktop)

  useEffect(() => {
    // This effect runs only on the client
    const checkDevice = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkDevice(); // Check on mount
    window.addEventListener('resize', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice); // Cleanup
    };
  }, []); // Empty dependency array ensures it runs only once on mount

  return isMobile;
}
