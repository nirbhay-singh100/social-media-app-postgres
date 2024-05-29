require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const db = require("../config/dbConfig");
const asyncHandler = require("express-async-handler");

//
//
//
//
//
//      find people with names
//
//
//
//
//
//
const findPerson = asyncHandler(async (req, res) => {
  const name = req.body.name;

  const result = await db.query(
    "select * from userdetails where full_name like $1",
    [name + "%"]
  );

  res.json(result.rows);
});

//
//
//
//
//
//          feed creation
//
//
//
//
//
//

const feedCreation = asyncHandler(async (req, res) => {
  const user_id = req.user_id;

  const feed = await db.query(
    "select userdetails.username , posts.* from (select followed_person from people where following_person = $1) as temp inner join posts on posts.owner_id = temp.followed_person inner join userdetails on userdetails.user_id = temp.followed_person order by posts.time_of_creation desc",
    [user_id]
  );

  res.json(feed.rows);
});

//
//
//
//
//
//          content upload (to upload content with images)
//
//
//
//
//
//
//

// packages to upload images using amazon s3
const crypto = require("crypto");

const client = require("../config/awsS3config");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// function to upload new Post into database
const uploadPost = asyncHandler(async (req, res) => {
  //
  // using crypto package to generate random and unique names for images
  const randomImageName = (bytes = 32) =>
    crypto.randomBytes(bytes).toString("hex");

  //
  // uploading image in s3 using PutObjectCommand
  var url = null;
  if (req.file) {
    const bucketName = process.env.BUCKET_NAME;

    const randomName = randomImageName() + req.file.originalname;
    const params = {
      Bucket: bucketName,
      Key: randomName,
      Body: req.file.buffer,
    };

    const uploadCommand = new PutObjectCommand(params);
    await client.send(uploadCommand);

    //
    // Getting a URL to access image without making s3 public
    const getUrlCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: randomName,
    });

    url = await getSignedUrl(client, getUrlCommand);
  }

  //inserting post into databse
  var allowComments = false;

  if (req.body.allowComments === "true") {
    allowComments = true;
  }
  const result = await db.query(
    "insert into posts (owner_id, allow_comments,image_url,post_content) values ($1, $2, $3, $4) returning *",
    [req.user_id, allowComments, url, req.body.content]
  );

  res.json(result.rows[0]);
});

//
//
//
//
//
// function to get details of a single post
//
//
//
//
//
//

const postDetails = asyncHandler(async (req, res) => {
  const post_id = Number(JSON.parse(req.body.post_id));
  const post = await db.query("select * from posts where post_id = $1", [
    post_id,
  ]);

  if (post.rows[0].allow_comments === true) {
    const fetchPostComments = await db.query(
      "select userdetails.username, temp.comment_content from (select commenter, comment_content from all_comments where post_id = $1) as temp inner join userdetails on userdetails.user_id = temp.commenter",
      [post_id]
    );

    comments = fetchPostComments.rows;
  }

  const allLikes = await db.query(
    "select userdetails.username from (select user_id from all_likes where post_id = $1) as temp inner join userdetails on userdetails.user_id = temp.user_id",
    [post_id]
  );

  res.json({
    postDetails: post.rows,
    comments: comments,
    allLikes: allLikes.rows,
  });
});

//
//
//
//
//
//
//
// function to follow a person
//
//
//
//
//
//
//
//

const followPeople = asyncHandler(async (req, res) => {
  const followingUser = req.user_id;
  const followedUser = req.body.username;

  const result = await db.query(
    "select user_id from userdetails where username = ($1)",
    [followedUser]
  );

  const check = await db.query(
    "select * from people where followed_person = $1 and following_person = $2",
    [result.rows[0].user_id, followingUser]
  );

  if (check.rows.length > 0) {
    res.send("connection already exist");

    throw new Error("connection already exist");
  }
  await db.query("insert into people values ($1, $2)", [
    result.rows[0].user_id,
    followingUser,
  ]);

  const followedDetails = await db.query(
    "select * from userdetails where user_id = $1",
    [result.rows[0].user_id]
  );

  const ans = await db.query(
    "update userdetails set followers = $1 where user_id = $2 returning *",
    [followedDetails.rows[0].followers + 1, result.rows[0].user_id]
  );

  const followingDetails = await db.query(
    "select * from userdetails where user_id = $1",
    [followingUser]
  );

  await db.query("update userdetails set following = $1 where user_id = $2", [
    followingDetails.rows[0].following + 1,
    followingUser,
  ]);

  res.json(ans.rows[0]);
});

//
//
//
//
//                     ............    COMMENTS     ..............
//
//
//
//
//
//

//
//
//
//
//
//            posting comments on post
//
//
//
//
//

const addComment = asyncHandler(async (req, res) => {
  const post_id = JSON.parse(req.body.post_id);
  const comment_owner = req.user_id;

  const checkPost = await db.query("select * from posts where post_id = $1", [
    post_id,
  ]);

  if (checkPost.rows[0].allow_comments === false) {
    res.json({ message: "comments are disable for this post" });
    throw new Error("you can't comment on this post");
  }
  const result = await db.query(
    "insert into all_comments (post_id, commenter, comment_content, comment_receiver) values ($1, $2, $3, $4) returning *",
    [post_id, comment_owner, req.body.content, checkPost.rows[0].owner_id]
  );

  await db.query("update posts set comments_count = $1 where post_id = $2", [
    checkPost.rows[0].comments_count + 1,
    Number(post_id),
  ]);

  res.json(result.rows[0]);
});

//
//
//
//
//
//
//              edit comment (can only be performed by a person who posted the comment)
//
//
//
//
//
//

const editComment = asyncHandler(async (req, res) => {
  const user_id = req.user_id;

  const comment_id = JSON.parse(req.body.comment_id);
  const newContent = req.body.content;

  const commentDetail = await db.query(
    "select commenter from all_comments where comment_id =$1 ",
    [Number(comment_id)]
  );

  console.log(commentDetail.rows[0].commenter);
  console.log(user_id);

  if (commentDetail.rows[0].commenter != user_id) {
    res.json({ message: "user not allowed to edit comment" });
    throw new Error("only the person who commented can edit the comment");
  }

  const result = await db.query(
    "update all_comments set comment_content = $1 where comment_id = $2 returning *",
    [newContent, comment_id]
  );

  res.json(result.rows[0]);
});

//
//
//
//
//
//
//
//            delete comment (can only be performed by the creator of comment of receiver of comment)
//
//
//
//
//
//
//

const deleteComment = asyncHandler(async (req, res) => {
  const comment_id = JSON.parse(req.body.comment_id);

  const commentDetails = await db.query(
    "select * from all_comments where comment_id = $1",
    [Number(comment_id)]
  );

  const commenter_id = commentDetails.rows[0].commenter;
  const receiver_id = commentDetails.rows[0].comment_receiver;

  if (req.user_id != commenter_id && req.user_id != receiver_id) {
    throw new Error(
      "Error! Only person who created or received comment can delete it"
    );
  }

  const result = await db.query(
    "delete from all_comments where comment_id = $1",
    [Number(comment_id)]
  );

  console.log(commentDetails.rows[0]);

  const postDetails = await db.query("select * from posts where post_id = $1", [
    commentDetails.rows[0].post_id,
  ]);

  await db.query("update posts set comments_count = $1 where post_id = $2", [
    postDetails.rows[0].comments_count - 1,
    postDetails.rows[0].post_id,
  ]);

  res.send("comment deleted");
});

//
//
//
//
//
//
//
//                  Likes
//
//
//
//
//
//
//

const like = asyncHandler(async (req, res) => {
  const post_id = JSON.parse(req.body.post_id);
  const user_id = req.user_id;

  const isPresent = await db.query(
    "select * from all_likes where post_id = $1 and user_id = $2",
    [post_id, user_id]
  );

  if (isPresent.rows.length === 1) {
    await db.query(
      "delete from all_likes where post_id = $1 and user_id = $2",
      [post_id, user_id]
    );

    const postDetails = await db.query(
      "select * from posts where post_id = $1",
      [post_id]
    );

    const ans = await db.query(
      "update posts set likes_count = $1 where post_id = $2 returning *",
      [postDetails.rows[0].likes_count - 1, post_id]
    );

    res.json(ans.rows[0]);
  } else {
    await db.query("insert into all_likes (post_id, user_id) values ($1, $2)", [
      post_id,
      user_id,
    ]);

    const postDetails = await db.query(
      "select * from posts where post_id = $1",
      [post_id]
    );

    const ans = await db.query(
      "update posts set likes_count = $1 where post_id = $2 returning *",
      [postDetails.rows[0].likes_count + 1, post_id]
    );

    res.json(ans.rows[0]);
  }
});

module.exports = {
  uploadPost,
  postDetails,
  followPeople,
  addComment,
  editComment,
  deleteComment,
  like,
  findPerson,
  feedCreation,
};
