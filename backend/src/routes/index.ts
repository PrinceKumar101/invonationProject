import { Router } from 'express';


const router = Router();

router.get("/health", (req, res)=>{
    res.send("Server is running");
})

export default router;
