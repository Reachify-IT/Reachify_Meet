var AppProcess = (function () {
  var peers_connection_ids = [];
  var peers_connection = [];
  var remote_vid_stream = [];
  var remote_aud_stream = [];
  var local_div;
  var video_states = {
    None: 0,
    Camera: 1,
    ScreenShare: 2,
  };
  var video_st = video_states.None;
  var videoCamTrack;
  var serverProcess;
  var audio;
  var isAudioMute = true;
  var rtp_aud_senders = [];
  var rtp_vid_senders = [];

  async function _init(SDP_function, my_connid) {
    serverProcess = SDP_function;
    my_connection_id = my_connid;
    eventProcess();
    local_div = document.getElementById("locaVideoPlayer");

  }
  function eventProcess() {
    $("#miceMuteUnmute").on("click", async function () {
      if (!audio) {
        await loadAudio();
      }
      if (!audio) {
        alert("Audio permission has not been granted");
        return;
      }
      if (isAudioMute) {
        audio.enabled = true;
        $(this).html("<span class='material-icons ricons' ><img src='public/Assets/images/micon.svg' alt='' ></span>");
        updateMediaSenders(audio, rtp_aud_senders);
        console.log(rtp_aud_senders);
      } else {
        audio.enabled = false;
        $(this).html("<span class='material-icons ricons'style='color:white;' >mic_off</span>");
        removeMediaSenders(rtp_aud_senders);
        audio.stop();
        console.log(rtp_aud_senders);
      }
      isAudioMute = !isAudioMute;

    });
    $("#videoCamOnOff").on("click", async function () {
      if (video_st == video_states.Camera) {
        await videoProcess(video_states.None);
      } else {
        await videoProcess(video_states.Camera);

      }
    });
    $("#ScreenShareOnOf").on("click", async function () {
      if (video_st == video_states.ScreenShare) {
        await videoProcess(video_states.None);
      } else {
        await videoProcess(video_states.ScreenShare);
      }
    });
  }
  async function loadAudio() {
    try {
      var astream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      audio = astream.getAudioTracks()[0];
      audio.enabled = false;
    } catch (e) {
      console.log(e);
    }
  }
  function connection_status(connection) {
    if (connection && (connection.connectionState == "new" ||
      connection.connectionState == "connecting"
      || connection.connectionState == "connected")) {
      return true;
    }
    else {
      return false;
    }
  }
  async function updateMediaSenders(track, rtp_senders) {
    for (var con_id in peers_connection_ids) {
      if (connection_status(peers_connection[con_id])) {
        if (rtp_senders[con_id] && rtp_senders[con_id].track) {
          rtp_senders[con_id].replaceTrack(track);
        } else {
          rtp_senders[con_id] = peers_connection[con_id].addTrack(track);

        }
      }
    }
  }
  function removeMediaSenders(rtp_senders) {
    console.log("rtp_senders :", rtp_senders);
    for (var con_id in peers_connection_ids) {
      if (rtp_senders[con_id] && connection_status(peers_connection[con_id])) {
        peers_connection[con_id].removeTrack(rtp_senders[con_id]);
        rtp_senders[con_id] = null;
      }
    }
  }
  function removeVideoStream(rtp_vid_senders) {
    if (videoCamTrack) {
      videoCamTrack.stop();
      videoCamTrack = null;
      local_div.srcObject = null;
      removeMediaSenders(rtp_vid_senders);
    }
  }
  async function videoProcess(newVideoState) {
    if (newVideoState == video_states.None) {
      $("#videoCamOnOff").html("<span class='material-icons  ricons'style='color:white;' >videocam_off</span>");

      $("#ScreenShareOnOf").html('<span class="material-icons  ricons"><img src="public/Assets/images/screenshare.svg" alt="" ></span>');
      video_st = newVideoState;
      removeVideoStream(rtp_vid_senders);
      console.log("rtp_vid_senders", rtp_vid_senders);
      serverProcess(
        JSON.stringify({
          Video_switch_off: "Video_switch_off",
        }),
        rtp_vid_senders
      );
      return;
    }
    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html("<span class='material-icons  ' >videocam</span>");
    }
    try {
      var vstream = null;
      if (newVideoState == video_states.Camera) {
        vstream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
      } else if (newVideoState == video_states.ScreenShare) {
        vstream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
        vstream.oninactive = (e) => {
          removeVideoStream(rtp_vid_senders);
          $("#ScreenShareOnOf").html('<span class="material-icons  ricons"><img src="public/Assets/images/screenshare.svg" alt="" ></span>');
        };
      }
      if (vstream && vstream.getVideoTracks().length > 0) {
        videoCamTrack = vstream.getVideoTracks()[0];
        if (videoCamTrack) {
          local_div.srcObject = new MediaStream([videoCamTrack]);
          updateMediaSenders(videoCamTrack, rtp_vid_senders);
        }
      }
    } catch (e) {
      console.log(e);
      return;
    } video_st = newVideoState;

    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html('<span class="material-icons ricons "style="color:white;" >videocam</span>');
      $("#ScreenShareOnOf").html('<span class="material-icons  ricons"><img src="public/Assets/images/screenshare.svg" alt="" ></span>'
      );
    } else if (newVideoState == video_states.ScreenShare) {
      $("#videoCamOnOff").html('<span class="material-icons ricons"style="color:white;">videocam_off</span>');

      $("#ScreenShareOnOf").html('<span class="material-icons text-success  ricons" ><img src="public/Assets/images/screenshare.svg" alt="" ></span>');
    }
  }
  var iceConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
      {
        urls: "stun:stun1.l.google.com:19302",
      },
    ],
  };

  async function setConnection(connid) {
    var connection = new RTCPeerConnection(iceConfiguration);

    connection.onnegotiationneeded = async function (event) {
      await setOffer(connid);
    };
    connection.onicecandidate = function (event) {
      if (event.candidate) {
        serverProcess(
          JSON.stringify({ icecandidate: event.candidate }),
          connid
        );
      }
    };
    connection.ontrack = function (event) {
      if (!remote_vid_stream[connid]) {
        remote_vid_stream[connid] = new MediaStream();
      }
      if (!remote_aud_stream[connid]) {
        remote_aud_stream[connid] = new MediaStream();
      }
      if (event.track.kind == "video") {
        remote_vid_stream[connid]
          .getVideoTracks()
          .forEach((t) => remote_vid_stream[connid].removeTrack(t));
        remote_vid_stream[connid].addTrack(event.track);
        var remoteVideoPlayer = document.getElementById("v_" + connid);
        remoteVideoPlayer.srcObject = null;
        remoteVideoPlayer.srcObject = remote_vid_stream[connid];
        remoteVideoPlayer.load();
      } else if (event.track.kind == "audio") {
        remote_aud_stream[connid]
          .getAudioTracks()
          .forEach((t) => remote_aud_stream[connid].removeTrack(t));
        remote_aud_stream[connid].addTrack(event.track);
        var remoteAudioPlayer = document.getElementById("a_" + connid);
        remoteAudioPlayer.srcObject = null;
        remoteAudioPlayer.srcObject = remote_aud_stream[connid];
        remoteAudioPlayer.load();
      }
    };
    peers_connection_ids[connid] = connid;
    peers_connection[connid] = connection;
    if (video_st == video_states.Camera || video_st == video_states.ScreenShare) {
      if (videoCamTrack) {
        updateMediaSenders(videoCamTrack, rtp_vid_senders);
      }
    }

    return connection;


  }
  async function setOffer(connid) {
    var connection = peers_connection[connid];
    var offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    serverProcess(
      JSON.stringify({
        offer: connection.localDescription,
      }),
      connid
    );
  }
  async function SDPProcess(message, from_connid) {
    message = JSON.parse(message);
    if (message.answer) {
      await peers_connection[from_connid].setRemoteDescription(new
        RTCSessionDescription(message.answer)
      );
    } else if (message.offer) {
      if (!peers_connection[from_connid]) {
        await setConnection(from_connid);

      }
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.offer)
      );
      var answer = await peers_connection[from_connid].createAnswer();
      await peers_connection[from_connid].setLocalDescription(answer);
      serverProcess(
        JSON.stringify({
          answer: answer,
        }),
        from_connid
      );

    } else if (message.icecandidate) {
      if (!peers_connection[from_connid]) {
        await setConnection(from_connid);
      }
      try {
        await peers_connection[from_connid].addIceCandidate(
          message.icecandidate
        );
      } catch (e) {
        console.log(e);
      }
    } else if (message.Video_switch_off) {
      document.querySelector("#v_" + from_connid + "").srcObject = null;
    }
  }
  async function closeConnection(connid) {
    peers_connection_ids[connid] = null;
    if (peers_connection[connid]) {
      peers_connection[connid].close();
      peers_connection[connid] = null;
    }
    if (remote_aud_stream[connid]) {
      remote_aud_stream[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      remote_aud_stream[connid] = null;
    }
    if (remote_vid_stream[connid]) {
      remote_vid_stream[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      remote_vid_stream[connid] = null;
    }
  }
  return {
    setNewConnection: async function (connid) {
      await setConnection(connid);
    },
    init: async function (SDP_function, my_connid) {
      await _init(SDP_function, my_connid);
    },
    processClientFunc: async function (data, from_connid) {
      await SDPProcess(data, from_connid);
    },
    closeConnectionCall: async function (connid) {
      await closeConnection(connid);
    },
  };
})();
var MyApp = (function () {
  var socket = null;
  var user_id = "";
  var meeting_id = "";
  function init(uid, mid) {
    user_id = uid;
    meeting_id = mid;
    $("#meetingContainer").show();
    $("#me h2").text(user_id + "(Me)");
    document.title = user_id;
    event_process_for_signaling_server();
    eventHandeling();
  }

  function event_process_for_signaling_server() {
    socket = io.connect();

    var SDP_function = function (data, to_connid) {
      socket.emit("SDPProcess", {
        message: data,
        to_connid: to_connid,
      });
    };
    socket.on("connect", () => {
      if (socket.connected) {
        AppProcess.init(SDP_function, socket.id);
        if (user_id != "" && meeting_id != "") {
          socket.emit("askToConnect", {
            displayName: user_id,
            meetingid: meeting_id,
          });
        }
      }
    });
    socket.on("inform_other_about_disconnected_user", function (data) {
      $("#" + data.connId).remove();
      $(".participant-count").text(data.uNumber);
      $("#participant_" + data.connId + "").remove();
      AppProcess.closeConnectionCall(data.connId);
    });

    socket.on("HandRaise_info_for_others", function (data) {
      if (data.handRaise) {
        $("#hand_" + data.connId).show();
      } else {
        $("#hand_" + data.connId).hide();
      }
    });
    var confirmModal = document.getElementById("confirmModal");
    var confirmModalLabel = document.getElementById("confirmModalLabel");
    var confirmModalBody = document.getElementById("confirmModalBody");
    var denyButton = document.getElementById("denyButton");
    var allowButton = document.getElementById("allowButton");

    function handleResponse(permissionGranted, data) {
      console.log("permissionGranted:", permissionGranted);
      console.log("data:", data);

      socket.emit("grant_join_permission", {
        permissionGranted: permissionGranted,
        data: data,
      });

      $(confirmModal).modal("hide");

      denyButton.removeEventListener("click", handleDeny);
      allowButton.removeEventListener("click", handleAllow);
    }

    socket.on("request_join_permission", function (data) {
      confirmModalBody.innerHTML = `${data.displayNames} wants to join the meeting ${data.meetingids}. Allow?`;

      $(confirmModal).modal("show");

      denyButton.addEventListener("click", handleDeny);
      allowButton.addEventListener("click", handleAllow);

      function handleDeny() {
        handleResponse(false, data);

        denyButton.removeEventListener("click", handleDeny);
        allowButton.removeEventListener("click", handleAllow);
      }

      function handleAllow() {
        handleResponse(true, data);

        denyButton.removeEventListener("click", handleDeny);
        allowButton.removeEventListener("click", handleAllow);
      }
    });

    socket.on("permission_denied", () => {
      alert("Permission denied by Host");

      socket.disconnect();
    });
    socket.on("inform_others_about_me", function (data) {
      addUser(data.other_user_id, data.connId, data.userNumber);

      AppProcess.setNewConnection(data.connId);
    });
    socket.on("showFileMessage", function (data) {
      var num_of_att = $(".left-align").length;
      var added_mar = num_of_att * 10;
      var mar_top = "-" + (135 + added_mar);
      $(".g-details").css({ "margin-top": mar_top });

      var time = new Date();
      var lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      var attachFileAreaForOther = document.querySelector(".show-attach-file");

      attachFileAreaForOther.innerHTML += "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/other.jpg' style='height:40px;width:40px;' class='caller-image circle'><div style='font-weight:600;margin:0 5px;'>" + data.username + "</div>:<div><a style='color:#007bff;' href='" + data.filePath + "' download>" + data.fileName + "</a></div></div><br/>";
    });
    socket.on("inform_me_about_other_user", function (other_users) {
      var userNumber = other_users.length;
      var userNumb = userNumber + 1;
      if (other_users) {
        for (var i = 0; i < other_users.length; i++) {
          addUser(
            other_users[i].user_id,
            other_users[i].connectionId,
            userNumb
          );
          AppProcess.setNewConnection(other_users[i].connectionId);
        }
      }
    });
    socket.on("SDPProcess", async function (data) {
      await AppProcess.processClientFunc(data.message, data.from_connid);
    });
    socket.on("showChatMessage", function (data) {
      var time = new Date();
      var lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      var div = $("<div style='display: flex;margin-top:20px;align-items: flex-end;'>").html(
        "<span class='mr-3' style='color: white; background-color:#4817EB; border-radius: 18px; border-radius: 50%; width: 40px; height: 40px; display: inline-flex; justify-content: center; align-items: center;align-self: flex-end;'>" +
        data.from.charAt(0) +
        "</span>" + "<div style=' max-width:180px; font-size: 16px; word-wrap: break-word;border-radius:20px 20px 20px 0px;align-self:flex-start;background-color:#4817EB;box-shadow:-2px 2px 4px #dcdcdc;padding:10px;'>" +
        "<span class=' mr-3' style='color:white'>" +
        data.message +
        "</span>" +
        "<span style='font-size:8px;color:white;justify-content: flex-end;  align-items: flex-end; '>" + lTime + "</span>" + "</div>"
      );
      $("#messages").prepend(div);
    });
  }
  function eventHandeling() {
    var handRaise = false;
    $("#handRaiseAction").on("click", async function () {
      if (!handRaise) {
        $("img.handRaise").show();
        handRaise = true;
        socket.emit("sendHandRaise", handRaise);
      } else {
        $("img.handRaise").hide();
        handRaise = false;
        socket.emit("sendHandRaise", handRaise);
      }
    });
    $("#btnsend").on("click", function () {
      var msgData = $("#msgbox").val();
      socket.emit("sendMessage", msgData);
      var time = new Date();
      var lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      var div = $("<div style='display: flex;margin-top:20px;align-items: flex-end;'>").html(
        "<span class='mr-3' style='color: white; background-color:#4817EB; border-radius: 18px; border-radius: 50%; width: 40px; height: 40px; display: inline-flex; justify-content: center; align-items: center;align-self: flex-end;'>" +
        user_id.charAt(0) +
        "</span>" + "<div style=' max-width:180px; font-size: 16px; word-wrap: break-word;border-radius:20px 20px 20px 0px;align-self:flex-start;background-color:#4817EB;box-shadow:-2px 2px 4px #dcdcdc;padding:10px;'>" +
        "<span class=' mr-3' style='color:white'>" +
        msgData +
        "</span>" +
        "<span style='font-size:8px;color:white;justify-content: flex-end;  align-items: flex-end; '>" + lTime + "</span>" + "</div>"
      );

      $("#messages").prepend(div);
      $("#msgbox").val("");
    });

    var url = window.location.href;
    $(".meeting_url").text(url);

    $("#divUsers").on("dblclick", "video", function () {
      this.requestFullscreen();
    });
  }

  function addUser(other_user_id, connId, userNum) {
    var newDivId = $("#otherTemplate").clone();
    newDivId = newDivId.attr("id", connId).addClass("other");
    newDivId.find("h2").text(other_user_id);
    newDivId.find("video").attr("id", "v_" + connId);
    newDivId.find("audio").attr("id", "a_" + connId);
    newDivId.find("img").attr("id", "hand_" + connId);
    const gridContainer = document.getElementsByClassName("video-wrap");
    const prevButton = document.getElementById("prevButton");
    const nextButton = document.getElementById("nextButton");
    let currentPage = 0;
    let boxesPerPage = 1; // Number of boxes per page
    let totalBoxes = userNum; // Initial total number of boxes

    function renderGrid() {
        $("#divUsers").empty(); // Clear previous grid

        let start = currentPage * boxesPerPage;
        let end = Math.min(start + boxesPerPage, totalBoxes);

        for (let i = start; i < end; i++) {
            let box = newDivId.clone();
            box.show();
            $("#divUsers").append(box);
        }

        // Show/hide navigation buttons based on current page
        if (currentPage === 0) {
            prevButton.style.display = 'none';
        } else {
            prevButton.style.display = 'inline-block';
        }

        if (end >= totalBoxes) {
            nextButton.style.display = 'none';
        } else {
            nextButton.style.display = 'inline-block';
        }
    }

    $(document).on("click", "#prevButton", function () {
        currentPage--;
        renderGrid();
    });

    $(document).on("click", "#nextButton", function () {
        currentPage++;
        renderGrid();
    });

    function addBox() {
        totalBoxes++;
        renderGrid();
    }

    renderGrid();

    $(".in-call-wrap-up").append(
      '<div class="in-call-wrap d-flex justify-content-between align-items-center mb-3" id="participant_' +
      connId +
      '"> <div class="participant-img-name-wrap display-center cursor-pointer"> <div class="participant-img"> <img src="public/Assets/images/other.jpg" alt="" class="border border-secondary" style="height: 40px;width: 40px;border-radius: 50%;"> </div> <div class="participant-name ml-2"> ' +
      other_user_id +
      '</div> </div> <div class="participant-action-wrap display-center"> <div class="participant-action-dot display-center mr-2 cursor-pointer"> <span class="material-icons"> more_vert </span> </div> <div class="participant-action-pin display-center mr-2 cursor-pointer"> <span class="material-icons"> push_pin </span> </div> </div> </div>'
    );
    $(".participant-count").text(userNum);
  }
  $(document).on("click", ".people-heading", function () {
    $(".in-call-wrap-up").show(300);
    $(".chat-show-wrap").hide(300);
    $(this).addClass("active");
    $(".chat-heading").removeClass("active");
  });
  $(document).on("click", ".chat-heading", function () {
    $(".in-call-wrap-up").hide(300);
    $(".chat-show-wrap").show(300);
    $(this).addClass("active");
    $(".people-heading").removeClass("active");
  });
  $(document).on("click", ".meeting-heading-cross", function () {
    $(".right-chat-detail-wrap").hide(300);

    $(".controls").show(300);
  });
  $(document).on("click", ".msgic", function () {
    $(".in-call-wrap-up").hide(300);
    $(".chat-show-wrap").show(300);
    $(".people-heading").removeClass("active");
    $(".controls").hide(300);
  });
  $(document).on("click", ".parts", function () {
    $(".in-call-wrap-up").show(300);
    $(".chat-show-wrap").hide(300);
    $(".chat-heading").removeClass("active");
    $(".controls").hide(300);
  });
  $(document).on("click", ".top-left-participant-wrap", function () {
    $(".people-heading").addClass("active");
    $(".chat-heading").removeClass("active");
    $(".right-chat-detail-wrap").show(300);
    $(".in-call-wrap-up").show(300);
    $(".chat-show-wrap").hide(300);
    $(".controls").hide(300);
  });
  $(document).on("click", ".top-left-chat-wrap", function () {
    $(".people-heading").removeClass("active");
    $(".chat-heading").addClass("active");
    $(".right-chat-detail-wrap").show(300);
    $(".in-call-wrap-up").hide(300);
    $(".chat-show-wrap").show(300);
  });
  $(document).on("click", ".end-call-wrap", function () {
    $(".top-box-show")
      .css({
        display: "block",
      })
      .html(
        '<div class="top-box align-vertical-middle profile-dialogue-show" style="width: 416px;height: 176px;border-radius: 15px;border:none;outline:none; background: var(--bg-new-home-screen, linear-gradient(113deg, #131313 43.65%, #565656 125.29%));"> <h4 class="mt-3" style="text-align:center;color:white;color:  #F8F8F8; font-family: Lato; font-size: 24px; font-style: normal;  font-weight: 500;  line-height: 150%;">Leave Meeting!</h4> <hr> <div class="call-leave-cancel-action d-flex justify-content-center align-items-center w-100"style="display: flex; height: 40px; padding: 12px 24px; justify-content: center; align-items: center; gap: 8px;"> <a href="/action.html"><button class="call-leave-action btn btn-danger mr-5"style="border-radius:25px;background-color:#F76969">Leave</button></a> <button class="call-cancel-action btn btn-secondary"style="display: flex; height: 40px;padding: 12px 24px;justify-content: center; align-items: center;gap: 8px;border-radius:25px;border-radius: 25px; border: 1px solid var(--text-secondary, rgba(48, 48, 48, 0.50));     background: var(--selection-side-bar, #FAFAFA);"><div style="color: #333;text-align: center; font-family: Lato;   font-size: 16px;   font-style: normal;   font-weight: 500;   line-height: 120%;">Cancel</button></div> </div> </div>'
      );
  });

  $(document).mouseup(function (e) {
    var container = new Array();
    container.push($(".obuttons"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length == 0) {
        $(value).hide(300);


      }
    });
  });
  $(document).on("click", ".call-cancel-action", function () {
    $(".top-box-show").html("");
  });
  $(document).on("click", ".copy_info", function () {
    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val($(".meeting_url").text()).select();
    document.execCommand("copy");
    $temp.remove();
    $(".link-conf").show();
    setTimeout(function () {
      $(".link-conf").hide();
    }, 3000);
  });
  $(document).on("click", ".meeting-details-button", function () {
    $(".g-details").slideDown(300);
  });
  $(document).on("click", ".attachment-img", function () {
    $(".attachment-block").show();

    $(this).addClass("active");
  });
  $(document).mouseup(function (e) {
    var container = new Array();

    container.push($(".attachment-block"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length == 0) {
        $(value).hide(300);

      }
    });
  });
  $(document).mouseup(function (e) {
    var container = new Array();

    container.push($(".g-details"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length == 0) {
        $(value).hide(300);

      }
    });
  });


  var base_url = window.location.origin;

  $(document).on("change", ".custom-file-input", function () {
    var fileName = $(this).val().split("\\").pop();
    $(this).siblings(".custom-file-label").addClass("selected").html(fileName);
  });

  $(document).on("click", ".share-attach", function (e) {
    e.preventDefault();
    var att_img = $("#customFile").prop("files")[0];
    var formData = new FormData();
    formData.append("zipfile", att_img);
    formData.append("meeting_id", meeting_id);
    formData.append("username", user_id);
    console.log(formData);
    $.ajax({
      url: base_url + "/attachimg",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (response) {
        console.log(response);
      },
      error: function () {
        console.log("error");
      },
    });

    var attachFileArea = document.querySelector(".show-attach-file");
    var attachFileName = $("#customFile").val().split("\\").pop();
    var attachFilePath =
      "public/attachment/" + meeting_id + "/" + attachFileName;
    attachFileArea.innerHTML +=
      "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/other.jpg' style='height:40px;width:40px;' class='caller-image circle'><div style='font-weight:600;margin:0 5px;'>" +
      user_id +
      "</div>:<div><a style='color:#007bff;' href='" +
      attachFilePath +
      "' download>" +
      attachFileName +
      "</a></div></div><br/>";
    $("label.custom-file-label").text("");
    socket.emit("fileTransferToOther", {
      username: user_id,
      meetingid: meeting_id,
      filePath: attachFilePath,
      fileName: attachFileName,
    });
  });
  $(document).on("click", ".option-icon", function () {
    $(".recording-show").toggle(300);
  });

  $(document).on("click", ".start-record", function () {
    $(this)
      .removeClass()
      .addClass("stop-record btn-danger text-dark")
      .css("border", "none")

      .text("Stop Recording");
    startRecording();
  });
  $(document).on("click", ".stop-record", function () {
    $(this)
      .removeClass()
      .addClass("start-record otext recafter")
      .css("border", "none")

      .text("Start Recording");

    mediaRecorder.stop();
  });

  var mediaRecorder;
  var chunks = [];
  async function captureScreen(
    mediaContraints = {
      video: true,
    }
  ) {
    const screenStream = await navigator.mediaDevices.getDisplayMedia(
      mediaContraints
    );
    return screenStream;
  }
  async function captureAudio(
    mediaContraints = {
      video: false,
      audio: true,
    }
  ) {
    const audioStream = await navigator.mediaDevices.getUserMedia(
      mediaContraints
    );
    return audioStream;
  }
  async function startRecording() {
    const screenStream = await captureScreen();
    const audioStream = await captureAudio();
    const stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks(),
    ]);
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    mediaRecorder.onstop = function (e) {
      var clipName = prompt("Enter a name for your recording");
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, {
        type: "video/webm",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = clipName + ".webm";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    };
    mediaRecorder.ondataavailable = function (e) {
      chunks.push(e.data);
    };
  }


  return {
    _init: function (uid, mid) {
      init(uid, mid);
    },
  };
})();
