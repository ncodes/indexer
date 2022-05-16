export default () => ({
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpMin: process.env.JWT_EXP_MIN,
    jwtFactorTokenExpMin: process.env.JWT_FACTOR_TOKEN_EXP_MIN,
  },
});
