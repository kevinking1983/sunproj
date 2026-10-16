import { checkAll } from "./oss-lib.mjs";

const ok = await checkAll();
process.exit(ok ? 0 : 1);
