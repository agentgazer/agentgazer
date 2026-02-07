import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { providerApi } from "../lib/api";

interface ConnectionContextType {
  isLoopback: boolean;
  loading: boolean;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isLoopback: false,
  loading: true,
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [isLoopback, setIsLoopback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    providerApi
      .getConnectionInfo()
      .then((info) => {
        setIsLoopback(info.isLoopback);
      })
      .catch(() => {
        setIsLoopback(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <ConnectionContext.Provider value={{ isLoopback, loading }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext);
}
