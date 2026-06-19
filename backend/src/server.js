require('dotenv').config();

const { createApp } = require('./app');

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const app = createApp();

app.listen(port, () => {
  console.log(`Document comparison backend listening on port ${port}`);
});
