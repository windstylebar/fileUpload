function revertName(id, name) {
    $('#' + id).html(name);
}

function renameFile(id, currentPath, oldname, newname) {
    $.ajax({
        url: "/rename/",
        data: {
            currentDir: currentPath + oldname,
            newName: newname
        },
        success: function(result) {
            if (result === "true") {
                alert('修改成功！');
                getFileList(currentPath);
            } else {
                revertName(id, oldname);
                alert('修改失败！');
            }

        },
        error: function() {
            revertName(id, oldname);
            alert('修改失败！');
        }
    })
}




function deleteFile(id, fileName) {
    // body...

    $.ajax({
        url: "/delete/",
        data: {
            currentDir: fileName
        },
        success: function(result) {
            if (result === "true") {
                if (id.startsWith("#folder")) {
                    var li = $(id).parent();
                    li.remove();
                } else {
                    var li = $(id).parent().parent();
                    li.remove();
                }

                alert('删除成功！');
            } else {
                alert('删除失败！');
            }

        },
        error: function() {
            alert('删除失败！');
        }
    })
}

function getFileSizeString(fileSize) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    if (fileSize == 0) return '0 Bytes';
    var i = parseInt(Math.floor(Math.log(fileSize) / Math.log(1024)));
    return Math.round(fileSize / Math.pow(1024, i), 2) + ' ' + sizes[i];
}


function confirmMove(e) {
    var checkValue = $("input[name='group1']:checked").val()
    if (checkValue) {

        $.ajax({
            url: "/move/",
            data: {
                currentFile: $("#moveSrc").val(),
                target: checkValue
            },
            success: function(result) {
                if (result === "true") {

                    alert("移动成功");
                    var movefileid = $($("#moveFileId").val()).parent().parent();
                    movefileid.remove();

                    $.unblockUI();

                } else {
                    alert('移动失败！');
                }

            },
            error: function() {
                alert('移动失败！');
                $.unblockUI();
            }
        });




    } else {
        alert("未选定文件夹")
    }

}

function cancelMove(e) {
    $.unblockUI();
}


function fakeMove(id, srcPath, filename) {
    $("#dirList").html('');
    $("#moveSrc").val(srcPath + filename);
    $("#moveFileId").val(id);

    $.ajax({
        url: "/listPath/",
        data: {
            currentDir: srcPath
        },
        success: function(data) {
            if (data) {
                var json = eval(data)
                if (json.length <= 0 || (json.length === 1 && json[0].fileName === filename)) {
                    alert("无文件夹，不能移动");

                } else {

                    for (var i = 0; i < json.length; i++) {
                        if (json[i].fileName === "" + filename) {
                            continue;
                        }

                        $("#dirList").append('<li> <span class="li_3"><input type="radio" name="group1" value="' + escape(json[i].fileName) + '">' + json[i].fileName + ' </span></li>')

                    }

                    $.blockUI({
                        message: $('#showmodel')
                    });
                }
            } else {
                alert('移动失败！');
            }

        },
        error: function() {
            alert('移动失败！');
        }
    });
}



function getFileList(path) {
    $("#fileList").html('');

    $.ajax({
        url: "/list/",
        data: {
            dir: path
        },
        success: function(data) {
            if (data) {
                json = eval(data)
                json.sort(function(a, b) {
                    return a["isdir"] < b["isdir"] ? 1 : -1
                })

                for (var i = 0; i < json.length; i++) {
                    var realIndex = i + 1;
                    if (json[i].isdir && json[i].isdir === 1) {
                        $("#fileList").append(
                            '<li><span class="li_01">&nbsp;</span> <span id = "folder' + realIndex + '" class="li_1"  style="cursor:hand" data-folderpath="' + path + json[i].fileName + '/">' + json[i].fileName +
                            '</span><span class="li_2" folder="' + json[i].fileName + '" >' + getFileSizeString(json[i].fileSize) +
                            '</span><span class="li_3">' + json[i].fileDate +
                            '</span><span class="li_4"><button data-fileid="folder' + realIndex + '">重命名</button>' +
                            '<button id="folder' + realIndex + '"  data-files="folder' + realIndex + '" data-filename="' + path + json[i].fileName + '">删除</button>' +
                            '<button id="moveFile' + realIndex + '" data-moveid="moveFile' + realIndex + '" data-movefilepath="' + path + '" data-movefile="' + json[i].fileName + '">移动文件</button></span></li>');

                    } else {
                        $("#fileList").append(
                            '<li><span class="li_02">&nbsp;</span> <span id = "file' + realIndex + '" class="li_1"><a href="' + path + json[i].fileName + '">' + json[i].fileName +
                            '</a></span><span class="li_2" fileName="' + json[i].fileName + '" >' + getFileSizeString(json[i].fileSize) +
                            '</span><span class="li_3">' + json[i].fileDate +
                            '</span><span class="li_4"><button data-fileid="file' + realIndex + '">重命名</button>' +
                            '<button id="files' + realIndex + '"  data-files="files' + realIndex + '" data-filename="' + path + json[i].fileName + '">删除</button>' +
                            '<button id="moveFile' + realIndex + '" data-moveid="moveFile' + realIndex + '" data-movefilepath="' + path + '" data-movefile="' + json[i].fileName + '">移动文件</button></span></li>');
                    }
                }


                var isChangeDir = true
                $('span[data-folderpath]').each(function() {
                    $(this).click(function(e) {
                        if (isChangeDir) {
                            var path = $(this).data('folderpath');
                            getFileList(path)
                            $("#currentPath").val(path).trigger('change');
                        }
                    });

                });


                $('button[data-fileid]').each(function() {
                    $(this).click(function(e) {
                        var fileId = "#" + $(this).data('fileid')
                        var btn = $(this)[0];

                        var editInPlace = $(fileId).editInPlace({
                            callback: function(id, n, o) {
                                //                                alert(id + " ：" + n + " ：" + o)
                                renameFile(id, $("#currentPath").val(), o, n)
                                return n;
                            },
                            delegate: {
                                "didCloseEditInPlace": function(a, b) {
                                    btn.disabled = !(btn.disabled)
                                    isChangeDir = true;
                                }
                            },
                            show_buttons: true
                        });
                        isChangeDir = false;
                        $(fileId).click();
                        btn.disabled = !(btn.disabled)
                    });
                });


                $('button[data-files]').each(function() {
                    $(this).click(function(e) {
                        var fileId = "#" + $(this).data('files')
                        //var btn = $(this)[0];
                        var deFile = $(this).data('filename')

                        deleteFile(fileId, deFile);
                    });
                });

                $('button[data-moveid]').each(function() {
                    $(this).click(function(e) {
                        var moveid = "#" + $(this).data('moveid')
                        var filepath = $(this).data('movefilepath')
                        var filename = $(this).data('movefile')
                        fakeMove(moveid, filepath, filename);

                    });
                });
            }
        }
    })
}


function createPath(folderid, currentDir, folderName) {

    $.ajax({
        url: "/createPath/",
        data: {
            currentDir: currentDir,
            folderName: folderName
        },
        success: function(result) {
            if (result === "true") {
                getFileList(currentDir);
            } else {
                var li = $(id).parent();
                li.remove();
                alert('创建失败！');
            }

        },
        error: function() {
            var li = $(id).parent();
            li.remove();
            alert('创建失败！');
        }
    })
}

function createFolder(evt) {

    var folderId = "newFoler" + new Date().Format("yyyyMMddhhmmss")
    $("#fileList").prepend('<li><span class="li_0" >&nbsp;</span><span id="' + folderId + '" class="li_1">&nbsp;</span> <span class="li_2">&nbsp;</span> <span class="li_3">&nbsp;</span> <span class="li_4">&nbsp;</span> </li>')

    var isCancel = true;
    var editInPlace = $("#" + folderId).editInPlace({
        callback: function(id, n, o) {
            // alert(id + " ：" + n + " ：" + o)
            createPath(id, $("#currentPath").val(), n)
            isCancel = false
            return n;
        },

        delegate: {
            "didCloseEditInPlace": function(a, b) {
                if (isCancel) {
                    var li = $("#" + folderId).parent();
                    li.remove();
                } else {
                    isCancel = true;
                }
            }
        },

        show_buttons: true
    });

    $("#" + folderId).click();




}
//------------------------
//上传队列
var uploaderQueue = null;

function GetQueueFor(path) {
    if (!uploaderQueue) {
        uploaderQueue = new bitcandies.FileUploader({
            url: path,
            maxconnections: 1,
            fieldname: "newfile",
            enqueued: function(item) {
                var fileName = item.getFilename();
                var fileSize = item.getSize();
                var strNew = $('<li><span class="li_0">&nbsp;</span><span class="li_1">' + fileName + '</span><span class="li_2" fileName="' + escape(fileName) + '">' + getFileSizeString(fileSize) + '</span><span class="li_3">等待上传...</span><span class="li_4"><a href="javascript:void(0);">删除</a></span><b></b></li>');
                $("#fileList").append(strNew);
                var itemId = item.id;
                strNew.find("a").click(function() {
                    var isRunning = false;
                    var isInQueue = false;
                    var isFailed = false;
                    for (var K in uploaderQueue.running) {
                        if (uploaderQueue.running[K].id === itemId) {
                            isRunning = true;
                            break;
                        }
                    }
                    for (var K in uploaderQueue.queue) {
                        if (uploaderQueue.queue[K].id === itemId) {
                            isInQueue = true;
                            break;
                        }
                    }
                    for (var K in uploaderQueue.faild) {
                        if (uploaderQueue.faild[K].id === itemId) {
                            isFailed = true;
                            break;
                        }
                    }
                    if (isRunning || isInQueue || isFailed) {
                        uploaderQueue.deleting = true;
                        if (isRunning) {
                            uploaderQueue.deleteItem(item);
                        } else {
                            if (isFailed) {
                                for (var K in uploaderQueue.faild) {
                                    if (uploaderQueue.faild[K].id === itemId) {
                                        uploaderQueue.faild.splice(K, 1);
                                        break;
                                    }
                                }
                            } else {
                                for (var K in uploaderQueue.queue) {
                                    if (uploaderQueue.queue[K].id === itemId) {
                                        uploaderQueue.queue.splice(K, 1);
                                        break;
                                    }
                                }
                            }
                        }
                        strNew.remove();
                        uploaderQueue.deleting = false;
                        uploaderQueue.run();
                    }
                });
            },
            progress: function(item, current, total) {
                var fileName = item.getFilename();
                var percent = current / total;
                var li_span = $("span[filename='" + escape(fileName) + "']");
                li_span.parent().removeClass("fail");
                li_span.parent().removeClass("succeed");
                li_span.parent().addClass("upload");
                var next_li_span = li_span.next();
                next_li_span.text(Math.round(percent * 100) + "%");
                var next_next_li_span = next_li_span.next().next();
                next_next_li_span.width(918 * percent);
            },
            success: function(item) {
                var fileName = item.getFilename();
                var li_span = $("span[filename='" + escape(fileName) + "']");
                //li_span.parent().addClass("succeed");
                li_span.parent().removeClass("upload");
                var li_status = li_span.next();
                li_status.text("上传成功");
                li_span.parent().find("a").removeClass("icon_2");
                li_span.parent().find("a").addClass("icon_1");
                li_span.parent().find("a").text("");

            },
            aborted: function(item) {
                var fileName = item.getFilename();
                var li_span = $("span[filename='" + escape(fileName) + "']");
                li_span.parent().addClass("fail");
                li_span.parent().removeClass("upload");
                var next_li_span = li_span.next();
                next_li_span.text("上传失败");
                console.log("item.id:" + item.id + "|aborted");
            },
            error: function(item, error) {
                var fileName = item.getFilename();
                var li_span = $("span[filename='" + escape(fileName) + "']");
                li_span.parent().addClass("fail");
                li_span.parent().removeClass("upload");
                var next_li_span = li_span.next();
                next_li_span.text("上传失败");
                console.log("item.id:" + item.id + "|error:" + error.status);
            }
        });
    } else {
        uploaderQueue.options.url = path;
    }
    return uploaderQueue;
}

//---------------

function CheckFileCanUpload(file) {
    //if (!file || !file.toLowerCase().match("(epub|txt|pdf|umd|doc|ppt|xls|chm|key|html|htm|zip|rar|cbz|cbr|docx|xlsx|pptx)$")) {
    //    return "添加文件失败！不支持此文件格式，请重新选择。";
    //}
    var filePath = file.split("\\");
    file = filePath[filePath.length - 1];
    var li_span = $("span[filename='" + escape(file) + "']");
    if (li_span.length > 0) {
        $(this).val("");
        return "文件已经存在或者在上传列队中。";
    }
    return null;
}

function Enqueue(currentPath, files) {
    var queue = GetQueueFor(currentPath);
    if (files.length == 1) {
        var msg = CheckFileCanUpload(files[0].name || files[0].fileName);
        if (msg) {
            alert(msg);
            return;
        }
        queue.add(files[0]);
        return;
    }

    var len = files.length;
    var uploadCount = 0;
    for (var i = 0; i < files.length; ++i) {
        if (!CheckFileCanUpload(files[i].name || files[i].fileName)) {
            queue.add(files[i]);
            uploadCount++;
        }
    }

    if (len != uploadCount) {
        var msg = "您选择了" + len + "个文件，只能上传" + uploadCount + "个文件。\n";
        msg += "文件名不能重复。";
        alert(msg);
    }
}
//------------------------
//Drag
var t = false;

function dragover(D) {
    D.stopPropagation();
    D.preventDefault();
    if (!t) {
        t = true;
    }
}

function dragleave(D) {
    D.stopPropagation();
    D.preventDefault();
    t = false;
}

function drop(D) {
    D.stopPropagation();
    D.preventDefault();

    t = false;
    if (D.dataTransfer && D.dataTransfer.files) {
        var E = D.dataTransfer.files.length;
        var F = D.dataTransfer.files;
        Enqueue($("#currentPath").val(), F);
    }
}

function initDragArea() {
    var D = document.getElementById("drag_area");
    if (D && D.addEventListener) {
        D.addEventListener("dragover", dragover, false);
        D.addEventListener("dragleave", dragleave, false);
        D.addEventListener("drop", drop, false);
    }
}

//============
//    

function initBind(idstring) {
    $(idstring).unbind();
    $(idstring).change(function() {
        if (typeof Worker !== "undefined") {
            var fileCount = this.files.length;
            Enqueue($("#currentPath").val(), this.files);

        } else {
            alert("请采用支持html5的浏览器");
        }
    });
}


function heartbeat() {

}

//===========================================
var z = 0

    function showUnconnectedMsg() {
        z++;
        if (typeof Worker !== "undefined" && z > 5) {
            for (var D = 0; D < uploaderQueue.running.length; ++D) {
                console.log("ajaxError abort id :" + uploaderQueue.running[D].id);
                uploaderQueue.abort(uploaderQueue.running[D]);
            }
            if (uploaderQueue.queue.length > 0) {
                uploaderQueue.run();
            } else {
                alert("无法连接服务器，请重新打开服务端并重试。");
            }
        }
    }

    function changeMainPath(path) {

        var strs = path.split("/")
        $('#mainpath').html('');

        if (strs.length >= 4) {
            var s = "/" + strs[1] + "/";
            $('#mainpath').append('<li><a data-mainpath="' + s + '"><img src="img/home.png" alt="Home" class="home"></li>')

            for (var i = 2; i < strs.length - 2; i++) {
                if (strs[i] === "")
                    continue;
                s = s + strs[i] + "/"
                $('#mainpath').append('<li><a data-mainpath="' + s + '">' + strs[i] + '</li>')
            };
            $('#mainpath').append('<li>' + strs[strs.length - 2] + '</li>')
        } else if (strs.length === 3) {
            $('#mainpath').append('<li><img src="img/home.png" alt="Home" class="home"></li>')
        }
        $('a[data-mainpath]').each(function() {
            $(this).click(function(e) {
                var upft = $(this).data('mainpath')
                getFileList(upft);
                $("#currentPath").val(upft).trigger('change');
            });

        });
    }



    //===============
    // document's ready
$(document).ready(function() {
    $("#createFolder").click(function(e) {
        createFolder(e)
    });

    $("#confirmMove").click(function(e) {
        confirmMove(e)
    });
    $("#cancelMove").click(function(e) {
        cancelMove(e)
    });
    $("#currentPath").change(function(e) {
        changeMainPath($(this).val());
    });

    getFileList("/upload/");
    //   createPath("/upload", "test")

    initBind("#newfile_0");

    if (typeof Worker !== "undefined") {
        $("#reupload").click(function() {
            $("#reupload").hide();
            var D = $(".fail");
            D.each(function(F) {
                $(this).removeClass("fail");
                $(this).find(".li_3").text("等待上传...");
            });
            for (var E = 0; E < uploaderQueue.faild.length; ++E) {
                uploaderQueue.queue.push(uploaderQueue.faild[E]);
            }
            uploaderQueue.faild = [];
            uploaderQueue.run();

        });
    }

    $(document).ajaxError(function(F, E, D) {
        showUnconnectedMsg();
    });

});
