let env_vars = {
	TS_NODE_PROJECT:'./automation/tsconfig.json',
	TS_NODE_FILES:true
};
if (process.version.match(/^v(\d+)/)[1]>16)
	env_vars['NODE_OPTIONS']='--openssl-legacy-provider';
module.exports = env_vars;