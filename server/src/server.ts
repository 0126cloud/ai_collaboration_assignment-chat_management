import app from './app';

const port = Number(process.env.SERVER_PORT) || 3000;
const address = process.env.SERVER_ADDRESS || 'localhost';

app.listen(port, address, () => {
  console.log(`Server is running on http://${address}:${port}`);
});
