require("aws-sdk/dist/aws-sdk");
AWS.config.update({accessKeyId: "AKIAJDFTRLW4CLBCUUAQ",secretAccessKey: "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"});
export function getS3Bucket() {
        return new AWS.S3({params:{Bucket:'s3-bucket-dev-task'}});
}

export function downloadObject(bucket,key) {
        var url = bucket.getSignedUrl('getObject',{Key:key});
        window.open(url,url);
}
function AWSPromise(resolve,reject) {
        return function(error,response) {
                if(error) {
                        reject(error);
                }else if (response) {
                        resolve(response);
                } else {
                        throw "No response or error"
                }
        }
}
export function uploadObject(bucket,file) {
        return new Promise(function(resolve,reject) {
                bucket.upload({Key:file.name,ContentType:file.type,Body:file},AWSPromise(resolve,reject));
        });
}
export function deleteObjectS3AndES(bucket,key) {
        var S3Delete = deleteObjectS3(bucket,key);
        var ESDelete = deleteObjectES(key);
        return Promise.all([S3Delete,ESDelete]);
}
export function deleteObjectS3(bucket,key) {
        return new Promise(function(resolve,reject) {
                bucket.deleteObject({Key:key},AWSPromise(resolve,reject));
        });
}

//Theres no nice API for this one
export function deleteObjectES(key) {
        return new Promise(function(resolve,reject) {
                var req = new XMLHttpRequest();
                const method = "DELETE";
                const url = "http://search-dev-task-search-cluster-ric5clhuvao44dtnhhhlnje7o4.us-west-2.es.amazonaws.com/files/file/_query"
                const data = JSON.stringify(
                                {
                                    "query":{
                                        "match_phrase": {
                                           "Key": key
                                        }
                                    }
                                });
                req.onreadystatechange = function() {
                        if(req.readyState === 4) {
                                if(req.status == 200) {
                                        resolve(req.response);
                                } else {
                                        reject(req.response);
                                }
                        }
                }
                req.open(method,url);
                req.send(data);
        });
}

// http://stackoverflow.com/questions/25354313/saving-a-uint8array-to-a-binary-file
function downloadData(data,fileName) {
  var a;
  a = document.createElement('a');
  a.href = data;
  a.download = fileName;
  document.body.appendChild(a);
  a.style = 'display: none';
  a.click();
  a.remove();
};
