# Package up the current git revision for submission to the Chrome webstore
all : blackbox-chrome-app.zip

clean :
	rm blackbox-chrome-app.zip

blackbox-chrome-app.zip : js/*
	git archive --format zip --output $@ master 