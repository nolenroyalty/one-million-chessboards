import React from "react";

export function useElementDimensions(ref) {
  const [size, setSize] = React.useState({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  });

  React.useEffect(() => {
    if (!ref.current) {
      return;
    }
    const elt = ref.current;
    const bounds = elt.getBoundingClientRect();
    setSize({
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      top: bounds.top,
    });
    const handleResize = () => {
      const bounds = elt.getBoundingClientRect();
      setSize({
        width: bounds.width,
        height: bounds.height,
        left: bounds.left,
        top: bounds.top,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ref]);

  return size;
}
