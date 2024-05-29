const express = require("express");
const verify = require("../middleware/verifyToken");
const multer = require("multer");

const {
  uploadPost,
  postDetails,
  followPeople,
  addComment,
  editComment,
  deleteComment,
  like,
  findPerson,
  feedCreation,
} = require("../controllers/applicationController");

const router = express.Router();

// specifying storage for multer
//
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

//
//
//
// find people
//
//
//
router.get("/findPerson", verify, findPerson);

//
//
//
// feed creation
//
//
//
router.get("/feed", verify, feedCreation);

//
//
//
// post route to upload post
//
//
//
router.post("/uploadPost", verify, upload.single("image"), uploadPost);

//
//
//
// get route to fetch all the details of post
//
//
//
router.get("/postdetails", verify, postDetails);

//
//
//
// Route to Follow people with username
//
//
//

router.post("/follow", verify, followPeople);

//
//
//
// routes of comments manipulatio
//
//
//

router.post("/addComment", verify, addComment);
router.post("/editComment", verify, editComment);
router.post("/deleteComment", verify, deleteComment);

//
//
//
// route for likes
//
//
//

router.post("/like", verify, like);

module.exports = router;
