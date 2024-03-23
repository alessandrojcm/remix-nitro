export default defineEventHandler((event) => {
  setCookie(event, "test_cookie", "I am a cookie");
  return { hello: "world" };
});
