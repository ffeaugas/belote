import { Button } from "@/components/ui/button";

const TestBack = () => {

  const testBack = async () => {
    try {
      const res = await fetch("http://localhost:3001/");
      const data = await res.text();
      console.log(data);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button onClick={testBack}>test</Button>
    </div>
  );
}

export default TestBack;