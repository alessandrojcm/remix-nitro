import { defineEventHandler } from "h3";

export default defineEventHandler(() => {
  const event = useEvent();
  event.context = {
    user: "hi",
  };
  return { hello: "world" };
});
