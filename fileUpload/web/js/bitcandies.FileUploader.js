var bitcandies = bitcandies || {};
bitcandies.defaults = function (a, c) {
    for (var b in c) {
        if (typeof a[b] == "undefined") {
            a[b] = c[b]
        }
    }
};
bitcandies.FileUploader = function (a) {
    var b = {
        fieldname: "file",
        maxconnections: 1,
        method: "POST",
        default_params: {},
        url: "",
        enqueued: function (c) { },
        aborted: function (c) { },
        start: function (c, d) { },
        progress: function (e, c, d, f) { },
        success: function (c, d) { },
        error: function (c, d) { },
        complete: function (c, d) { }
    };
    this.options = a || {};
    bitcandies.defaults(this.options, b);
    this.queue = [];
    this.running = [];
    this.completed = [];
    this.faild = [];
    this._curid = 1;
    this.deleting = false
};
bitcandies.FileUploader.Statuses = {
    QUEUED: "queued",
    ABORTED: "aborted",
    UPLOADING: "uploading",
    COMPLETED: "completed"
};
bitcandies.FileUploader.QueuedFile = function (b, a, c, d) {
    if (!(a instanceof File)) {
        throw new Error("Cannot add a non-File object to upload queue.")
    }
    this.uploader = b;
    this.file = a;
    this.params = c || {};
    this.id = d;
    this.status = bitcandies.FileUploader.Statuses.QUEUED
};
bitcandies.FileUploader.QueuedFile.prototype = {
    getFilename: function () {
        return this.file.fileName ? this.file.fileName : this.file.name
    },
    getSize: function () {
        return this.file.fileSize ? this.file.fileSize : this.file.size
    },
    getFile: function () {
        return this.file
    },
    getParams: function () {
        return this.params
    },
    getStatus: function () {
        return this.status
    }
};
bitcandies.FileUploader.prototype = {
    add: function (a, c) {
        c = c || {};
        bitcandies.defaults(c, this.options.default_params);
        var b = new bitcandies.FileUploader.QueuedFile(this, a, c, this._curid);
        this._curid++;
        this.queue.push(b);
        this.options.enqueued.call(this, b);
        this.run();
        return b
    },
    abort: function (a) {
        if (a.status !== bitcandies.FileUploader.Statuses.COMPLETED && a.status !== bitcandies.FileUploader.Statuses.ABORTED) {
            this.setFaildItem(a)
        }
    },
    deleteItem: function (b) {
        if (b.status !== bitcandies.FileUploader.Statuses.COMPLETED && b.status !== bitcandies.FileUploader.Statuses.ABORTED) {
            for (var a = 0; a < this.running.length; ++a) {
                console.log("this.running[i].id:" + this.running[a].id);
                if (b.id === this.running[a].id) {
                    b.status = bitcandies.FileUploader.Statuses.ABORTED;
                    b.xhr.abort();
                    this.options.aborted.call(this, b);
                    return
                }
            }
        }
    },
    setFaildItem: function (b) {
        console.log("setFaildItem id:" + b.id);
        for (var a = 0; a < this.queue.length; ++a) {
            console.log("this.queue[i].id:" + this.queue[a].id);
            if (b.id === this.queue[a].id) {
                this.queue.splice(a, 1);
                b.status = bitcandies.FileUploader.Statuses.ABORTED;
                this.options.aborted.call(this, b);
                this.faild.push(b);
                console.log("this.faild.push id:" + b.id);
                return
            }
        }
        for (var a = 0; a < this.running.length; ++a) {
            console.log("this.running[i].id:" + this.running[a].id);
            if (b.id === this.running[a].id) {
                b.status = bitcandies.FileUploader.Statuses.ABORTED;
                b.xhr.abort();
                this.options.aborted.call(this, b);
                this.faild.push(b);
                console.log("this.faild.push id:" + b.id);
                return
            }
        }
    },
    doUpload: function (d) {
        var a = this,
        f = new XMLHttpRequest(),
        e = new FormData();
        d.status = bitcandies.FileUploader.Statuses.UPLOADING;
        d.xhr = f;
        this.options.start.call(this, d, f);
        f.onreadystatechange = function () {
            console.log("item.id:" + d.id + "|onreadystatechange:" + f.readyState);
            if (f.readyState == 4) {
                a.onComplete(d, f)
            }
        };
        f.upload.onprogress = function (g) {
            if (g.lengthComputable) {
                a.options.progress.call(a, d, g.loaded, g.total, f)
            }
        };
        f.open(this.options.method, this.options.url, true);
        for (var c in d.params) {
            e.append(c, d.params[c])
        }
        e.append(this.options.fieldname, d.file);
        try {
            f.send(e)
        } catch (b) {
            console.log(b)
        }
    },
    isRunning: function () {
        return this.queue.length || this.running.length
    },
    onComplete: function (b, c) {
        if (b.status !== bitcandies.FileUploader.Statuses.ABORTED) {
            b.status = bitcandies.FileUploader.Statuses.COMPLETED;
            this.options.progress.call(this, b, b.getSize(), b.getSize(), c);
            if (c.status == 200) {
                this.options.success.call(this, b, c)
            } else {
                this.options.error.call(this, b, c);
                this.setFaildItem(b)
            }
            this.options.complete.call(this, b, c)
        }
        if (b.xhr) {
            delete b.xhr
        }
        for (var a in this.running) {
            if (this.running[a].id === b.id) {
                console.log("this.running.splice id:" + b.id);
                this.running.splice(a, 1);
                break
            }
        }
        this.run()
    },
    run: function () {
        if (this.queue.length > 0 && this.running.length < this.options.maxconnections && !this.deleting) {
            for (var a = 0; a < this.options.maxconnections - this.running.length; ++a) {
                var b = this.queue.shift();
                console.log("this.queue.shift item id :" + b.id);
                this.running.push(b);
                this.doUpload(b)
            }
        }
    }
};