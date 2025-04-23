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
    let timeout;

    const updateDimensions = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        const bounds = elt.getBoundingClientRect();
        setSize({
          width: bounds.width,
          height: bounds.height,
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
        });
      }, 50);
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(elt);

    window.addEventListener("resize", updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [ref]);

  return size;
}
