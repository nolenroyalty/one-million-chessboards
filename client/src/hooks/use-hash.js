import React from "react";

function getHash() {
  return window.location.hash.slice(1);
}

export function useHash() {
  const [hash, setHash] = React.useState(getHash());
  React.useEffect(() => {
    const handleHashChange = () => setHash(getHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);
  return hash;
}
