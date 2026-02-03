import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import "./index.css";

import TestBack from "./TestBack";

export function App() {
  return (
    <div className="container mx-auto p-8 text-center relative z-10 w-100">
      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-3xl font-bold">Belote</CardTitle>
          <CardDescription>
            Test de belote
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestBack />
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
