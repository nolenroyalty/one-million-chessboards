import React from "react";

const LastTransitionDebounceDelayContext = React.createContext();

function LastTransitionDebounceDelayProvider({ children }) {
  const [lastTransitionDebounceDelay, setLastTransitionDebounceDelay] =
    React.useState(0);

  const value = React.useMemo(
    () => ({ lastTransitionDebounceDelay, setLastTransitionDebounceDelay }),
    [lastTransitionDebounceDelay, setLastTransitionDebounceDelay]
  );

  return (
    <LastTransitionDebounceDelayContext.Provider value={value}>
      {children}
    </LastTransitionDebounceDelayContext.Provider>
  );
}

export { LastTransitionDebounceDelayProvider };
export default LastTransitionDebounceDelayContext;
