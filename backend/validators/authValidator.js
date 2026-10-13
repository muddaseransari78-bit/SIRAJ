const { z } = require("zod");
const { passwordProblems, MAX_LENGTH } = require("../utils/passwordPolicy");

// Strong password rules live in utils/passwordPolicy.js (length, letter + number, not common).
const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().trim().max(254).email("Enter a valid email address"),
    password: z.string().max(MAX_LENGTH, `Password must be at most ${MAX_LENGTH} characters`),
  })
  .superRefine((data, ctx) => {
    for (const message of passwordProblems(data.password, { email: data.email })) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message });
    }
  });

// Login does NOT apply the strength rules (old accounts must still be able to log in),
// but it does cap the length so nobody can send a huge string to bcrypt.
const loginSchema = z.object({
  email: z.string().trim().max(254).email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").max(MAX_LENGTH, "Invalid email or password"),
});

// Google / Apple: the ID token from the provider + the random nonce the browser used
const socialSchema = z.object({
  credential: z.string().min(20).max(8192),
  nonce: z.string().min(8).max(200),
  name: z.string().trim().max(80).optional(),
});

/**
 * Generic middleware factory: validates req.body against a Zod schema.
 * On failure, responds with 400 and the list of validation issues.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { registerSchema, loginSchema, socialSchema, validate };
