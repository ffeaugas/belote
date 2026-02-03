import { Button } from "@/components/ui/button";
import { Input } from "./components/ui/input";
import { api } from "@/lib/api";

const TestBack = () => {

  const testBack = async () => {
    const { data, error } = await api.get()
    console.log(data);
  }

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const id = formData.get("id") as string;

    const { data, error } = await api.id({ id }).get({
      query: { name: formData.get("name") as string }
    })
    console.log(error?.value.message);
    console.log(data)
  }

  return (
    <div className="flex flex-col gap-6">
      <Button onClick={testBack}>test</Button>
      <form onSubmit={handleSubmit}>
        <Input type="text" placeholder="Enter id" name="id" />
        <Input type="text" placeholder="Enter name" name="name" />
        <Button type="submit">test</Button>
      </form>
    </div>
  );
}

export default TestBack;    