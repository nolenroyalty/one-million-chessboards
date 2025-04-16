import React from "react";

function getHash() {
  return window.location.hash.slice(1);
}

export function useHash() {
  const [hash, setHash] = React.useState(getHash());
  React.useEffect(() => {
    const handleHashChange = () => {
      const h = getHash();
      console.log("hashchange", h);
      setHash(h);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const clearStoredHash = React.useCallback(() => {
    setHash("");
  }, [setHash]);

  return { hash, clearStoredHash };
}
