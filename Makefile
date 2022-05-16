test:
	jest src/controllers/users --maxWorkers=1 --verbose && \
	jest src/controllers/auth --maxWorkers=1 --verbose && \
	jest src/controllers/wallets --maxWorkers=1 --verbose && \
	jest src/controllers/misc --maxWorkers=1 --verbose && \
	jest src/jobs --maxWorkers=1 --verbose && \
	jest src/services --maxWorkers=1 --verbose